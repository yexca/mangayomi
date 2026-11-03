import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"
import { useTranslation } from "react-i18next"

import { LoadMore } from "@/components/load-more"
import { Button } from "@/components/ui/button"
import type { PagedList } from "@/hooks/use-paged-list"
import { cn } from "@/lib/utils"

/** The end of a paged list: the infinite-scroll sentinel or the page controls. */
export function ListFooter({ list }: { list: PagedList<unknown> }) {
  if (list.mode === "scroll") return <LoadMore query={list.scroll} />
  if (list.pageCount <= 1) return null
  return <Pager page={list.page} pageCount={list.pageCount} onPage={list.setPage} />
}

/** Page numbers to show: the first, the last, and two around the current one. */
function pageItems(page: number, count: number): (number | "gap")[] {
  const shown = new Set([1, count, page - 1, page, page + 1].filter((p) => p >= 1 && p <= count))
  const sorted = [...shown].sort((a, b) => a - b)
  const out: (number | "gap")[] = []
  sorted.forEach((p, i) => {
    const prev = sorted[i - 1]
    if (prev !== undefined && p - prev === 2) out.push(prev + 1)
    else if (prev !== undefined && p - prev > 2) out.push("gap")
    out.push(p)
  })
  return out
}

function Pager({ page, pageCount, onPage }: { page: number; pageCount: number; onPage: (page: number) => void }) {
  const { t } = useTranslation()
  return (
    <nav aria-label={t("pager.label")} className="mt-8 flex items-center justify-center gap-1">
      <Button
        variant="ghost"
        size="icon"
        disabled={page <= 1}
        onClick={() => onPage(page - 1)}
        aria-label={t("pager.previous")}
      >
        <ChevronLeftIcon />
      </Button>
      <span className="px-2 text-sm text-muted-foreground tabular-nums sm:hidden">
        {t("pager.pageOf", { page, total: pageCount })}
      </span>
      {pageItems(page, pageCount).map((p, i) =>
        p === "gap" ? (
          <span key={`gap-${i}`} className="hidden w-6 text-center text-muted-foreground sm:inline">
            …
          </span>
        ) : (
          <Button
            key={p}
            variant={p === page ? "outline" : "ghost"}
            size="icon"
            className={cn("hidden tabular-nums sm:inline-flex", p === page && "pointer-events-none")}
            aria-current={p === page ? "page" : undefined}
            aria-label={t("pager.page", { page: p })}
            onClick={() => onPage(p)}
          >
            {p}
          </Button>
        ),
      )}
      <Button
        variant="ghost"
        size="icon"
        disabled={page >= pageCount}
        onClick={() => onPage(page + 1)}
        aria-label={t("pager.next")}
      >
        <ChevronRightIcon />
      </Button>
    </nav>
  )
}
