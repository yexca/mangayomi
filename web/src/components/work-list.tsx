import { useEffect, type ReactNode } from "react"

import { ListFooter } from "@/components/list-footer"
import { SelectionBar } from "@/components/selection-bar"
import { CardGrid, WorkCard } from "@/components/work-card"
import { usePagedList } from "@/hooks/use-paged-list"
import type { Selection } from "@/hooks/use-selection"
import { api, type Work, type WorkQuery } from "@/lib/api"
import { cn } from "@/lib/utils"
import { GridSkeleton } from "@/pages/home"

interface WorkListProps {
  query: Omit<WorkQuery, "offset" | "limit">
  selection: Selection
  empty?: ReactNode
  subtitle?: (w: Work) => string | undefined
  onTotal?: (total: number) => void
}

/** Grid of works, loaded while scrolling or by page, with multi-select support. */
export function WorkList({ query, selection, empty, subtitle, onTotal }: WorkListProps) {
  const list = usePagedList(["works", query], (offset, limit) =>
    api.works({ ...query, offset, limit }).then((r) => ({ items: r.works, total: r.total })),
  )
  const { items: works, total } = list

  useEffect(() => {
    if (total !== undefined) onTotal?.(total)
  }, [total, onTotal])

  if (list.isLoading) return <GridSkeleton />
  if (works.length === 0 && !list.isChangingPage) return <>{empty}</>

  return (
    <>
      <CardGrid lazy={list.mode === "scroll"} className={cn(list.isChangingPage && "opacity-60 transition-opacity")}>
        {works.map((w) => (
          <WorkCard
            key={w.id}
            work={w}
            subtitle={subtitle?.(w)}
            selecting={selection.active}
            selected={selection.ids.has(w.id)}
            onToggle={selection.toggle}
          />
        ))}
      </CardGrid>
      <ListFooter list={list} />
      <SelectionBar selection={selection} allIds={works.map((w) => w.id)} />
    </>
  )
}
