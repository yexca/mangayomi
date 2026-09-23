import { useMutation, useQueryClient } from "@tanstack/react-query"
import { FileArchiveIcon, FolderIcon, ImagesIcon, Loader2Icon, PlusIcon, ScanSearchIcon, XIcon } from "lucide-react"
import { useState, type FormEvent, type ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { FolderPicker } from "@/components/folder-picker"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { api, type Library, type LibraryInput, type PreviewItem, type ReadingDirection } from "@/lib/api"
import { errorMessage } from "@/lib/format"
import { cn } from "@/lib/utils"

const PRESETS = ["{author}/{series}", "{series}", "{author}", ""] as const
const INTERVALS = [0, 60, 360, 720, 1440]

const empty: LibraryInput = {
  name: "",
  path: "",
  pattern: "{author}/{series}",
  excludes: [],
  readingDirection: "rtl",
  scanInterval: 360,
}

interface LibraryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The library to edit; omit to add a new one. */
  library?: Library
}

export function LibraryDialog({ open, onOpenChange, library }: LibraryDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col sm:max-w-2xl">
        {/* Mounted only while open, so every opening starts from a fresh form. */}
        <LibraryForm library={library} onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  )
}

function toInput(library?: Library): LibraryInput {
  if (!library) return empty
  const { name, path, pattern, excludes, readingDirection, scanInterval } = library
  return { name, path, pattern, excludes, readingDirection, scanInterval }
}

function LibraryForm({ library, onDone }: { library?: Library; onDone: () => void }) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const id = library?.id
  const [form, setForm] = useState<LibraryInput>(() => toInput(library))
  const [picking, setPicking] = useState<"root" | "exclude" | null>(null)
  const [preview, setPreview] = useState<{ items: PreviewItem[]; truncated: boolean } | null>(null)

  const set = <K extends keyof LibraryInput>(key: K, value: LibraryInput[K]) => {
    setForm((f) => ({ ...f, [key]: value }))
    if (key === "path" || key === "pattern" || key === "excludes") setPreview(null)
  }

  const save = useMutation({
    mutationFn: () => (id ? api.updateLibrary(id, form) : api.createLibrary(form)),
    onSuccess: () => {
      qc.invalidateQueries()
      toast.success(id ? t("libraryForm.updated") : t("libraryForm.created"))
      onDone()
    },
    onError: (err) => toast.error(errorMessage(err, t)),
  })

  const runPreview = useMutation({
    mutationFn: () => api.previewLibrary({ path: form.path, pattern: form.pattern, excludes: form.excludes }),
    onSuccess: setPreview,
    onError: (err) => toast.error(errorMessage(err, t)),
  })

  const submit = (e: FormEvent) => {
    e.preventDefault()
    save.mutate()
  }

  const isPreset = (PRESETS as readonly string[]).includes(form.pattern)

  return (
    <>
      <DialogHeader>
        <DialogTitle>{id ? t("libraryForm.editTitle") : t("libraryForm.newTitle")}</DialogTitle>
        <DialogDescription className="sr-only">{t("settings.librariesDescription")}</DialogDescription>
      </DialogHeader>

      <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col gap-4">
        <div className="-mx-4 min-h-0 flex-1 space-y-8 overflow-y-auto px-4 pb-1">
          <Field label={t("libraryForm.folder")}>
            <div className="flex items-center gap-2">
              <div className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-lg border bg-muted/40 px-3 text-sm">
                <FolderIcon className="size-4 shrink-0 text-muted-foreground" />
                <span className={cn("truncate font-mono text-xs", !form.path && "text-muted-foreground")}>
                  {form.path || t("libraryForm.noFolder")}
                </span>
              </div>
              <Button type="button" variant="outline" onClick={() => setPicking("root")}>
                {form.path ? t("libraryForm.change") : t("libraryForm.chooseFolder")}
              </Button>
            </div>
          </Field>

          <Field label={t("libraryForm.name")}>
            <Input
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder={form.path ? form.path.split(/[\\/]/).pop() : t("libraryForm.namePlaceholder")}
            />
          </Field>

          <Separator />

          <Field label={t("libraryForm.pattern")} description={t("libraryForm.patternDescription")}>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((p) => (
                <Button
                  key={p || "flat"}
                  type="button"
                  size="sm"
                  variant={form.pattern === p ? "default" : "outline"}
                  className="font-mono"
                  onClick={() => set("pattern", p)}
                >
                  {p || t("libraryForm.patternFlat")}
                </Button>
              ))}
              <Button
                type="button"
                size="sm"
                variant={!isPreset ? "default" : "outline"}
                onClick={() => {
                  if (isPreset) set("pattern", "{ignore}/{author}/{series}")
                }}
              >
                {t("libraryForm.patternCustom")}
              </Button>
            </div>
            {!isPreset && (
              <div className="space-y-1.5">
                <Input className="font-mono" value={form.pattern} onChange={(e) => set("pattern", e.target.value)} />
                <p className="text-xs text-muted-foreground">{t("libraryForm.patternHelp")}</p>
              </div>
            )}
            <PatternExample pattern={form.pattern} />
          </Field>

          <Field label={t("libraryForm.excludes")} description={t("libraryForm.excludesDescription")}>
            {form.excludes.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("libraryForm.noExcludes")}</p>
            ) : (
              <ul className="divide-y rounded-lg border">
                {form.excludes.map((ex) => (
                  <li key={ex} className="flex items-center gap-2 py-1.5 pr-1.5 pl-3">
                    <FolderIcon className="size-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate font-mono text-xs">{ex}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={t("common.remove")}
                      onClick={() => set("excludes", form.excludes.filter((e) => e !== ex))}
                    >
                      <XIcon />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            <Button type="button" variant="outline" size="sm" disabled={!form.path} onClick={() => setPicking("exclude")}>
              <PlusIcon />
              {t("libraryForm.addExclude")}
            </Button>
          </Field>

          <Separator />

          <div className="grid gap-6 sm:grid-cols-2">
            <Field label={t("libraryForm.direction")}>
              <ToggleGroup
                type="single"
                variant="outline"
                spacing={0}
                value={form.readingDirection}
                onValueChange={(v) => v && set("readingDirection", v as ReadingDirection)}
              >
                <ToggleGroupItem value="rtl">{t("reader.rtl")}</ToggleGroupItem>
                <ToggleGroupItem value="ltr">{t("reader.ltr")}</ToggleGroupItem>
              </ToggleGroup>
            </Field>
            <Field label={t("libraryForm.scanInterval")}>
              <Select value={String(form.scanInterval)} onValueChange={(v) => set("scanInterval", Number(v))}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INTERVALS.map((m) => (
                    <SelectItem key={m} value={String(m)}>
                      {m === 0 ? t("libraryForm.intervalManual") : t("libraryForm.intervalHours", { count: m / 60 })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <Separator />

          <Field label={t("libraryForm.preview")} description={t("libraryForm.previewDescription")}>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!form.path || runPreview.isPending}
              onClick={() => runPreview.mutate()}
            >
              {runPreview.isPending ? <Loader2Icon className="animate-spin" /> : <ScanSearchIcon />}
              {t("libraryForm.previewRun")}
            </Button>
            {preview && <PreviewTable items={preview.items} truncated={preview.truncated} />}
          </Field>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onDone}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" disabled={!form.path || save.isPending}>
            {save.isPending && <Loader2Icon className="animate-spin" />}
            {t("common.save")}
          </Button>
        </DialogFooter>
      </form>

      <FolderPicker
        open={picking === "root"}
        onOpenChange={(o) => !o && setPicking(null)}
        title={t("folderPicker.title")}
        initialPath={form.path || undefined}
        onSelect={(path) => set("path", path)}
      />
      <FolderPicker
        open={picking === "exclude"}
        onOpenChange={(o) => !o && setPicking(null)}
        title={t("folderPicker.excludeTitle")}
        base={form.path}
        requireSubfolder
        onSelect={(_, rel) => rel && !form.excludes.includes(rel) && set("excludes", [...form.excludes, rel])}
      />
    </>
  )
}

function Field({ label, description, children }: { label: string; description?: string; children: ReactNode }) {
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label>{label}</Label>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {children}
    </div>
  )
}

/** A small folder tree showing how the pattern maps folders to metadata. */
function PatternExample({ pattern }: { pattern: string }) {
  const { t } = useTranslation()
  const tokens = pattern
    .split("/")
    .map((s) => s.trim())
    .filter(Boolean)
  const labels: Record<string, [string, string]> = {
    "{author}": [t("libraryForm.exampleAuthor"), t("libraryForm.colAuthor")],
    "{series}": [t("libraryForm.exampleSeries"), t("libraryForm.colSeries")],
  }
  const depth = tokens.length
  return (
    <div className="rounded-lg border bg-muted/30 p-3 font-mono text-xs leading-6">
      {tokens.map((tok, i) => {
        const [name, role] = labels[tok.toLowerCase()] ?? [t("libraryForm.exampleAny"), t("libraryForm.roleIgnored")]
        return (
          <Line key={i} indent={i} icon={<FolderIcon className="size-3.5" />} name={`${name}/`} role={role} />
        )
      })}
      <Line indent={depth} icon={<FileArchiveIcon className="size-3.5" />} name="Volume 01.cbz" role={t("libraryForm.colTitle")} />
      <Line indent={depth} icon={<ImagesIcon className="size-3.5" />} name="Volume 02/" role={t("libraryForm.colTitle")} />
      <Line indent={depth + 1} icon={<span className="size-3.5" />} name="001.jpg, 002.jpg, …" muted />
    </div>
  )
}

function Line({ indent, icon, name, role, muted }: { indent: number; icon: ReactNode; name: string; role?: string; muted?: boolean }) {
  return (
    <div className="flex items-center gap-1.5" style={{ paddingLeft: `${indent * 1.25}rem` }}>
      <span className="text-muted-foreground">{icon}</span>
      <span className={cn("truncate", muted && "text-muted-foreground")}>{name}</span>
      {role && <span className="ml-auto shrink-0 pl-3 font-sans text-[11px] text-muted-foreground">→ {role}</span>}
    </div>
  )
}

function PreviewTable({ items, truncated }: { items: PreviewItem[]; truncated: boolean }) {
  const { t } = useTranslation()
  if (items.length === 0) return <p className="text-sm text-muted-foreground">{t("libraryForm.previewEmpty")}</p>
  return (
    <div className="space-y-2">
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">{t("libraryForm.colTitle")}</th>
              <th className="px-3 py-2 font-medium">{t("libraryForm.colAuthor")}</th>
              <th className="px-3 py-2 font-medium">{t("libraryForm.colSeries")}</th>
              <th className="hidden px-3 py-2 font-medium md:table-cell">{t("libraryForm.colPath")}</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {items.map((it) => (
              <tr key={it.relPath}>
                <td className="px-3 py-2">
                  <span className="flex items-center gap-1.5">
                    {it.kind === "folder" ? (
                      <ImagesIcon className="size-3.5 shrink-0 text-muted-foreground" />
                    ) : (
                      <FileArchiveIcon className="size-3.5 shrink-0 text-muted-foreground" />
                    )}
                    {it.title}
                  </span>
                </td>
                <td className="px-3 py-2 text-muted-foreground">{it.author || "—"}</td>
                <td className="px-3 py-2 text-muted-foreground">{it.series || "—"}</td>
                <td className="hidden max-w-xs truncate px-3 py-2 font-mono text-xs text-muted-foreground md:table-cell">
                  {it.relPath}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {truncated && <p className="text-xs text-muted-foreground">{t("libraryForm.previewTruncated")}</p>}
    </div>
  )
}
