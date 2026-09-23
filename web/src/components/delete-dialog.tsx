import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { FileArchiveIcon, FolderIcon, Loader2Icon, TriangleAlertIcon } from "lucide-react"
import { useState } from "react"
import { Trans, useTranslation } from "react-i18next"
import { toast } from "sonner"

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
import { ScrollArea } from "@/components/ui/scroll-area"
import { api, type DeleteResult, type DeleteTarget } from "@/lib/api"
import { errorMessage, formatBytes } from "@/lib/format"

interface DeleteDialogProps {
  /** What to delete; the dialog is open while this is set. */
  target: DeleteTarget | null
  onClose: () => void
  onDeleted?: (result: DeleteResult) => void
}

/**
 * Two-step deletion: step one lists every file and folder that will be
 * removed; step two asks for explicit confirmation (typing "delete" for
 * bulk operations). The server only deletes what the preview listed.
 */
export function DeleteDialog({ target, onClose, onDeleted }: DeleteDialogProps) {
  const [busy, setBusy] = useState(false)
  return (
    <Dialog open={target !== null} onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        {/* Mounted only while open, so each target starts at the review step. */}
        {target && <DeleteFlow target={target} onClose={onClose} onDeleted={onDeleted} onBusy={setBusy} />}
      </DialogContent>
    </Dialog>
  )
}

function DeleteFlow({
  target,
  onClose,
  onDeleted,
  onBusy,
}: {
  target: DeleteTarget
  onClose: () => void
  onDeleted?: (result: DeleteResult) => void
  onBusy: (busy: boolean) => void
}) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const [step, setStep] = useState<"review" | "confirm">("review")
  const [typed, setTyped] = useState("")

  const plan = useQuery({
    queryKey: ["delete-preview", target],
    queryFn: () => api.deletePreview(target),
    gcTime: 0,
    staleTime: 0,
    retry: false,
  })

  const confirm = useMutation({
    mutationFn: (token: string) => api.deleteConfirm(token),
    onMutate: () => onBusy(true),
    onSettled: () => onBusy(false),
    onSuccess: (res) => {
      qc.invalidateQueries({ predicate: (q) => q.queryKey[0] !== "auth" && q.queryKey[0] !== "delete-preview" })
      if (res.deleted.length > 0) toast.success(t("delete.deleted", { count: res.deleted.length }))
      if (res.failed.length > 0) {
        toast.error(t("delete.failed", { count: res.failed.length }), {
          description: res.failed.map((f) => `${f.path}: ${f.error}`).join("\n"),
          duration: 15000,
        })
      }
      onDeleted?.(res)
      onClose()
    },
    onError: (err) => {
      toast.error(errorMessage(err, t))
      setStep("review")
      plan.refetch()
    },
  })

  const data = plan.data
  const count = data?.items.length ?? 0
  const bulk = count > 1 || !!target.series?.length || !!target.authors?.length
  const canDelete = !bulk || typed.trim().toLowerCase() === t("delete.confirmWord")

  return step === "review" ? (
    <>
      <DialogHeader>
        <DialogTitle>{t("delete.reviewTitle")}</DialogTitle>
        <DialogDescription>{t("delete.reviewDescription")}</DialogDescription>
      </DialogHeader>

      {plan.isLoading && (
        <div className="flex justify-center py-12 text-muted-foreground">
          <Loader2Icon className="size-5 animate-spin" />
        </div>
      )}
      {plan.error && <p className="text-sm text-destructive">{errorMessage(plan.error, t)}</p>}
      {data && count === 0 && <p className="text-sm text-muted-foreground">{t("delete.nothing")}</p>}
      {data && count > 0 && (
        <div className="min-w-0 space-y-3">
          <p className="text-sm font-medium">
            {t("delete.summary", {
              items: t("common.works", { count }),
              files: t("common.files", { count: data.totalFiles }),
              size: formatBytes(data.totalSize),
            })}
          </p>
          <ScrollArea className="max-h-[45vh] rounded-lg border">
            <ul className="divide-y">
              {data.items.map((it) => (
                <li key={it.id} className="flex items-start gap-3 px-3 py-2.5">
                  {it.kind === "folder" ? (
                    <FolderIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  ) : (
                    <FileArchiveIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{it.title}</p>
                    <p className="font-mono text-xs break-all text-muted-foreground">{it.path}</p>
                  </div>
                  <div className="shrink-0 text-right text-xs text-muted-foreground tabular-nums">
                    <p>{formatBytes(it.size)}</p>
                    {it.kind === "folder" && <p>{t("common.files", { count: it.files })}</p>}
                  </div>
                </li>
              ))}
            </ul>
          </ScrollArea>
          {data.emptyDirs?.length > 0 && (
            <div className="rounded-lg bg-muted/60 p-3 text-xs">
              <p className="mb-1.5 text-muted-foreground">{t("delete.emptyDirs")}</p>
              <ul className="space-y-0.5 font-mono break-all">
                {data.emptyDirs.map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          {t("common.cancel")}
        </Button>
        <Button variant="destructive" disabled={!data || count === 0} onClick={() => setStep("confirm")}>
          {t("common.continue")}
        </Button>
      </DialogFooter>
    </>
  ) : (
    <>
      <DialogHeader>
        <div className="mb-2 flex size-10 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <TriangleAlertIcon className="size-5" />
        </div>
        <DialogTitle>{t("delete.confirmTitle")}</DialogTitle>
        <DialogDescription>{t("delete.confirmDescription", { count })}</DialogDescription>
      </DialogHeader>
      {bulk && (
        <div className="space-y-2">
          <p className="text-sm">
            <Trans i18nKey="delete.typeToConfirm" components={{ strong: <strong className="font-mono" /> }} />
          </p>
          <Input
            autoFocus
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            onKeyDown={(e) => {
              if (e.key === "Enter" && canDelete && data) confirm.mutate(data.token)
            }}
          />
        </div>
      )}
      <DialogFooter>
        <Button variant="outline" disabled={confirm.isPending} onClick={() => setStep("review")}>
          {t("common.back")}
        </Button>
        <Button
          className="bg-destructive text-white hover:bg-destructive/90"
          disabled={!canDelete || confirm.isPending || !data}
          onClick={() => data && confirm.mutate(data.token)}
        >
          {confirm.isPending && <Loader2Icon className="animate-spin" />}
          {confirm.isPending ? t("delete.deleting") : t("delete.deletePermanently")}
        </Button>
      </DialogFooter>
    </>
  )
}
