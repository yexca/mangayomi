import { useQuery } from "@tanstack/react-query"
import {
  ArrowLeftIcon,
  BookCheckIcon,
  BookIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  PlayIcon,
  RotateCcwIcon,
  Trash2Icon,
} from "lucide-react"
import { useState, type ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { Link, useNavigate, useParams } from "react-router"

import { Cover } from "@/components/cover"
import { DeleteDialog } from "@/components/delete-dialog"
import { useMarkCompleted } from "@/components/group-actions"
import { EmptyState } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { api, type DeleteTarget } from "@/lib/api"
import { formatBytes, formatDate } from "@/lib/format"
import { authorLink, seriesLink } from "@/lib/links"

export function WorkPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const id = Number(useParams().id)
  const [deleting, setDeleting] = useState<DeleteTarget | null>(null)
  const mark = useMarkCompleted()
  const query = useQuery({ queryKey: ["work", id], queryFn: () => api.work(id) })
  const w = query.data

  if (query.error) {
    return <EmptyState title={t("work.notFound")} action={<Button onClick={() => navigate(-1)}>{t("common.back")}</Button>} />
  }
  if (!w) {
    return (
      <div className="flex flex-col gap-6 sm:flex-row">
        <Skeleton className="aspect-[2/3] w-44 rounded-lg sm:w-56" />
        <div className="flex-1 space-y-3">
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-4 w-1/3" />
        </div>
      </div>
    )
  }

  const p = w.progress
  const reading = p && !p.completed
  const pct = p ? (p.completed ? 100 : Math.round(((p.page + 1) / w.pageCount) * 100)) : 0

  return (
    <>
      <Button variant="ghost" size="sm" className="-ml-2 mb-4" onClick={() => navigate(-1)}>
        <ArrowLeftIcon />
        {t("common.back")}
      </Button>

      <div className="flex flex-col gap-6 sm:flex-row sm:gap-8">
        <Link to={`/read/${w.id}`} className="mx-auto w-44 shrink-0 sm:mx-0 sm:w-56">
          <Cover id={w.id} version={w.mtime} alt={w.title} className="shadow-md ring-1 ring-foreground/10" />
        </Link>

        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold tracking-tight break-words sm:text-3xl">{w.title}</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {w.author && (
              <Link to={authorLink(w.author, 0)} className="hover:text-foreground hover:underline">
                {w.author}
              </Link>
            )}
            {w.author && w.series && " · "}
            {w.series && (
              <Link to={seriesLink(w.author, w.series, 0)} className="hover:text-foreground hover:underline">
                {w.series}
              </Link>
            )}
          </p>

          <div className="mt-5 flex flex-wrap gap-2">
            <Button size="lg" asChild>
              <Link to={`/read/${w.id}`}>
                <PlayIcon />
                {reading ? t("work.continue", { page: p.page + 1 }) : p?.completed ? t("work.readAgain") : t("work.read")}
              </Link>
            </Button>
            {reading && (
              <Button size="lg" variant="outline" asChild>
                <Link to={`/read/${w.id}?page=0`}>
                  <RotateCcwIcon />
                  {t("reader.startOver")}
                </Link>
              </Button>
            )}
            <Button
              size="lg"
              variant="outline"
              disabled={mark.isPending}
              onClick={() => mark.mutate({ target: { workIds: [w.id] }, completed: !p?.completed })}
            >
              {p?.completed ? <BookIcon /> : <BookCheckIcon />}
              {p?.completed ? t("browse.markUnread") : t("browse.markRead")}
            </Button>
            <Button size="lg" variant="destructive" onClick={() => setDeleting({ workIds: [w.id] })}>
              <Trash2Icon />
              {t("common.delete")}
            </Button>
          </div>

          {p && (
            <div className="mt-5 max-w-md space-y-1.5">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{p.completed ? t("work.completed") : t("work.pageOf", { page: p.page + 1, total: w.pageCount })}</span>
                <span className="tabular-nums">{pct}%</span>
              </div>
              <Progress value={pct} />
            </div>
          )}

          <dl className="mt-6 grid max-w-xl grid-cols-[auto_1fr] gap-x-6 gap-y-2.5 text-sm">
            <Row label={t("work.pages")}>{w.pageCount}</Row>
            <Row label={t("work.size")}>{formatBytes(w.size)}</Row>
            <Row label={t("work.type")}>{w.kind === "archive" ? t("work.typeArchive") : t("work.typeFolder")}</Row>
            <Row label={t("work.library")}>{w.libraryName}</Row>
            <Row label={t("work.added")}>{formatDate(w.addedAt)}</Row>
            <Row label={t("work.path")}>
              <span className="font-mono text-xs break-all">{w.path}</span>
            </Row>
          </dl>

          {(w.prev || w.next) && (
            <div className="mt-8 flex flex-wrap gap-2">
              {w.prev && (
                <Button variant="outline" asChild className="max-w-full">
                  <Link to={`/works/${w.prev.id}`} replace>
                    <ChevronLeftIcon />
                    <span className="truncate">{w.prev.title}</span>
                  </Link>
                </Button>
              )}
              {w.next && (
                <Button variant="outline" asChild className="max-w-full">
                  <Link to={`/works/${w.next.id}`} replace>
                    <span className="truncate">{w.next.title}</span>
                    <ChevronRightIcon />
                  </Link>
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      <DeleteDialog
        target={deleting}
        onClose={() => setDeleting(null)}
        onDeleted={(res) => res.deleted.includes(w.id) && navigate(-1)}
      />
    </>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </>
  )
}
