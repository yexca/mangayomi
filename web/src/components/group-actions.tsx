import { useMutation, useQueryClient } from "@tanstack/react-query"
import { BookCheckIcon, BookIcon, Trash2Icon } from "lucide-react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu"
import { api, type DeleteTarget } from "@/lib/api"
import { errorMessage } from "@/lib/format"

/** Hook for bulk read-state changes on a group of works. */
// oxlint-disable-next-line react/only-export-components
export function useMarkCompleted() {
  const { t } = useTranslation()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ target, completed }: { target: DeleteTarget; completed: boolean }) =>
      api.markCompleted(target, completed),
    onSuccess: () => qc.invalidateQueries(),
    onError: (err) => toast.error(errorMessage(err, t)),
  })
}

/** Menu items shared by series and author cards and headers. */
export function GroupMenuItems({
  target,
  deleteLabel,
  onDelete,
}: {
  target: DeleteTarget
  deleteLabel: string
  onDelete: (target: DeleteTarget) => void
}) {
  const { t } = useTranslation()
  const mark = useMarkCompleted()
  return (
    <>
      <DropdownMenuItem onSelect={() => mark.mutate({ target, completed: true })}>
        <BookCheckIcon />
        {t("series.markAllRead")}
      </DropdownMenuItem>
      <DropdownMenuItem onSelect={() => mark.mutate({ target, completed: false })}>
        <BookIcon />
        {t("series.markAllUnread")}
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem variant="destructive" onSelect={() => onDelete(target)}>
        <Trash2Icon />
        {deleteLabel}
      </DropdownMenuItem>
    </>
  )
}
