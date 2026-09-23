import { useMutation, useQueryClient } from "@tanstack/react-query"
import { BookCheckIcon, BookIcon, Trash2Icon, XIcon } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { DeleteDialog } from "@/components/delete-dialog"
import { Button } from "@/components/ui/button"
import type { Selection } from "@/hooks/use-selection"
import { api, type DeleteTarget } from "@/lib/api"
import { errorMessage } from "@/lib/format"

/** Floating action bar for multi-selected works. */
export function SelectionBar({ selection, allIds }: { selection: Selection; allIds: number[] }) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const [deleting, setDeleting] = useState<DeleteTarget | null>(null)
  const ids = [...selection.ids]

  const mark = useMutation({
    mutationFn: (completed: boolean) => api.markCompleted({ workIds: ids }, completed),
    onSuccess: () => {
      qc.invalidateQueries()
      selection.stop()
    },
    onError: (err) => toast.error(errorMessage(err, t)),
  })

  if (!selection.active) return null
  const allSelected = allIds.length > 0 && allIds.every((id) => selection.ids.has(id))

  return (
    <>
      <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-40 flex justify-center px-3 md:bottom-6 md:pl-56">
        <div className="flex w-full max-w-2xl items-center gap-1 rounded-xl border bg-popover/95 p-1.5 shadow-lg backdrop-blur">
          <Button variant="ghost" size="icon" onClick={selection.stop} aria-label={t("common.close")}>
            <XIcon />
          </Button>
          <span className="px-1 text-sm font-medium tabular-nums">{t("common.selectedCount", { count: ids.length })}</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => selection.setMany(allSelected ? [] : allIds)}
          >
            {allSelected ? t("common.clearSelection") : t("common.selectAll")}
          </Button>
          <div className="ml-auto flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              disabled={ids.length === 0 || mark.isPending}
              onClick={() => mark.mutate(true)}
              title={t("browse.markRead")}
            >
              <BookCheckIcon />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              disabled={ids.length === 0 || mark.isPending}
              onClick={() => mark.mutate(false)}
              title={t("browse.markUnread")}
            >
              <BookIcon />
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={ids.length === 0}
              onClick={() => setDeleting({ workIds: ids })}
            >
              <Trash2Icon />
              {t("common.delete")}
            </Button>
          </div>
        </div>
      </div>
      <DeleteDialog target={deleting} onClose={() => setDeleting(null)} onDeleted={() => selection.stop()} />
    </>
  )
}
