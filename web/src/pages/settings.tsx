import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  FolderIcon,
  Loader2Icon,
  LogOutIcon,
  MoreHorizontalIcon,
  PencilIcon,
  PlusIcon,
  RefreshCwIcon,
  Trash2Icon,
} from "lucide-react"
import { useTheme } from "next-themes"
import { useState, type FormEvent, type ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router"
import { toast } from "sonner"

import { PageHeader } from "@/components/page-header"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { useReaderPrefs } from "@/hooks/use-reader-prefs"
import { useScanStatus } from "@/hooks/use-scan-status"
import { languages } from "@/i18n"
import { api, type Library } from "@/lib/api"
import { errorMessage, formatRelative } from "@/lib/format"
import { ReaderSettingsFields } from "@/pages/reader"

export function SettingsPage() {
  const { t } = useTranslation()
  return (
    <>
      <PageHeader title={t("settings.title")} />
      <div className="max-w-3xl space-y-10">
        <LibrariesSection />
        <Separator />
        <Section title={t("settings.reader")} description={t("settings.readerDescription")}>
          <ReaderDefaults />
        </Section>
        <Separator />
        <Section title={t("settings.appearance")}>
          <Appearance />
        </Section>
        <Separator />
        <Section title={t("settings.account")}>
          <Account />
        </Section>
        <Separator />
        <Section title={t("settings.about")}>
          <p className="text-sm text-muted-foreground">{t("settings.aboutText")}</p>
        </Section>
      </div>
    </>
  )
}

function Section({ title, description, actions, children }: { title: string; description?: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <section>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
          {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
        </div>
        {actions && <div className="flex gap-2">{actions}</div>}
      </div>
      {children}
    </section>
  )
}

function LibrariesSection() {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const libs = useQuery({ queryKey: ["libraries"], queryFn: api.libraries })
  const scans = useScanStatus()
  const [removing, setRemoving] = useState<Library | null>(null)

  const scan = useMutation({
    mutationFn: (id?: number) => (id ? api.scanLibrary(id) : api.scanAll()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["scan-status"] }),
    onError: (err) => toast.error(errorMessage(err, t)),
  })
  const remove = useMutation({
    mutationFn: (id: number) => api.deleteLibrary(id),
    onSuccess: () => {
      qc.invalidateQueries()
      setRemoving(null)
    },
    onError: (err) => toast.error(errorMessage(err, t)),
  })

  const list = libs.data?.libraries ?? []
  return (
    <Section
      title={t("settings.libraries")}
      description={t("settings.librariesDescription")}
      actions={
        <>
          {list.length > 1 && (
            <Button variant="outline" onClick={() => scan.mutate(undefined)}>
              <RefreshCwIcon />
              {t("settings.scanAll")}
            </Button>
          )}
          <Button asChild>
            <Link to="/settings/libraries/new">
              <PlusIcon />
              {t("settings.addLibrary")}
            </Link>
          </Button>
        </>
      }
    >
      {libs.isLoading && <Loader2Icon className="size-5 animate-spin text-muted-foreground" />}
      {libs.data && list.length === 0 && (
        <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">{t("settings.noLibraries")}</p>
      )}
      <div className={list.length > 0 ? "divide-y rounded-xl border" : undefined}>
        {list.map((lib) => {
          const st = scans.data?.scans.find((s) => s.libraryId === lib.id)
          return (
            <div key={lib.id} className="flex items-center gap-3 p-3 sm:p-4">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <FolderIcon className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <p className="truncate font-medium">{lib.name}</p>
                  <span className="shrink-0 text-xs text-muted-foreground">{t("common.works", { count: lib.workCount })}</span>
                </div>
                <p className="truncate font-mono text-xs text-muted-foreground">{lib.path}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {st?.running ? (
                    <span className="inline-flex items-center gap-1 text-foreground">
                      <Loader2Icon className="size-3 animate-spin" />
                      {t("settings.scanning", { count: st.scanned })}
                    </span>
                  ) : st?.error ? (
                    <span className="text-destructive">{t("settings.scanError", { error: st.error })}</span>
                  ) : lib.lastScanAt ? (
                    t("settings.lastScan", { time: formatRelative(lib.lastScanAt) })
                  ) : (
                    t("settings.neverScanned")
                  )}
                </p>
              </div>
              <Button
                variant="outline"
                size="icon"
                disabled={st?.running}
                onClick={() => scan.mutate(lib.id)}
                title={t("settings.scanNow")}
                aria-label={t("settings.scanNow")}
              >
                <RefreshCwIcon className={st?.running ? "animate-spin" : undefined} />
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label={t("common.more")}>
                    <MoreHorizontalIcon />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem asChild>
                    <Link to={`/settings/libraries/${lib.id}`}>
                      <PencilIcon />
                      {t("common.edit")}
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" onSelect={() => setRemoving(lib)}>
                    <Trash2Icon />
                    {t("settings.removeLibrary")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )
        })}
      </div>

      <AlertDialog open={removing !== null} onOpenChange={(o) => !o && setRemoving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("settings.removeLibraryTitle", { name: removing?.name })}</AlertDialogTitle>
            <AlertDialogDescription>{t("settings.removeLibraryDescription")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={remove.isPending}
              onClick={(e) => {
                e.preventDefault()
                if (removing) remove.mutate(removing.id)
              }}
            >
              {t("common.remove")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Section>
  )
}

function ReaderDefaults() {
  const [prefs, setPrefs] = useReaderPrefs()
  return (
    <div className="max-w-md space-y-5">
      <ReaderSettingsFields
        layout={prefs.layout}
        onLayout={(layout) => setPrefs({ layout })}
        fit={prefs.fit}
        onFit={(fit) => setPrefs({ fit })}
        coverAlone={prefs.coverAlone}
        onCoverAlone={(coverAlone) => setPrefs({ coverAlone })}
      />
    </div>
  )
}

function Appearance() {
  const { t, i18n } = useTranslation()
  const { theme, setTheme } = useTheme()
  return (
    <div className="grid max-w-md gap-4 sm:grid-cols-2">
      <div className="space-y-2">
        <Label>{t("settings.theme")}</Label>
        <Select value={theme ?? "system"} onValueChange={setTheme}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="system">{t("settings.themeSystem")}</SelectItem>
            <SelectItem value="light">{t("settings.themeLight")}</SelectItem>
            <SelectItem value="dark">{t("settings.themeDark")}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>{t("settings.language")}</Label>
        <Select value={i18n.resolvedLanguage ?? "en"} onValueChange={(v) => i18n.changeLanguage(v)}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {languages.map((l) => (
              <SelectItem key={l.code} value={l.code}>
                {l.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}

function Account() {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const [current, setCurrent] = useState("")
  const [next, setNext] = useState("")

  const change = useMutation({
    mutationFn: () => api.changePassword(current, next),
    onSuccess: () => {
      toast.success(t("settings.passwordChanged"))
      setCurrent("")
      setNext("")
    },
    onError: (err) => toast.error(errorMessage(err, t)),
  })
  const logout = useMutation({
    mutationFn: api.logout,
    onSettled: () => {
      qc.removeQueries({ predicate: (q) => q.queryKey[0] !== "auth" })
      qc.invalidateQueries({ queryKey: ["auth"] })
    },
  })

  const submit = (e: FormEvent) => {
    e.preventDefault()
    change.mutate()
  }

  return (
    <div className="max-w-md space-y-6">
      <form onSubmit={submit} className="space-y-3">
        <p className="text-sm font-medium">{t("settings.changePassword")}</p>
        <div className="space-y-2">
          <Label htmlFor="current">{t("settings.currentPassword")}</Label>
          <Input id="current" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="next">{t("settings.newPassword")}</Label>
          <Input id="next" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
          <p className="text-xs text-muted-foreground">{t("auth.passwordHint", { count: 6 })}</p>
        </div>
        <Button type="submit" variant="outline" disabled={!current || next.length < 6 || change.isPending}>
          {change.isPending && <Loader2Icon className="animate-spin" />}
          {t("common.save")}
        </Button>
      </form>
      <Button variant="outline" onClick={() => logout.mutate()}>
        <LogOutIcon />
        {t("auth.signOut")}
      </Button>
    </div>
  )
}
