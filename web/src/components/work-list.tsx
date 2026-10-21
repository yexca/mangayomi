import { useInfiniteQuery } from "@tanstack/react-query"
import { useEffect, useMemo, type ReactNode } from "react"

import { LoadMore } from "@/components/load-more"
import { SelectionBar } from "@/components/selection-bar"
import { CardGrid, WorkCard } from "@/components/work-card"
import type { Selection } from "@/hooks/use-selection"
import { api, type Work, type WorkQuery } from "@/lib/api"
import { GridSkeleton } from "@/pages/home"

const PAGE = 60

interface WorkListProps {
  query: Omit<WorkQuery, "offset" | "limit">
  selection: Selection
  empty?: ReactNode
  subtitle?: (w: Work) => string | undefined
  onTotal?: (total: number) => void
}

/** Infinite-scrolling grid of works with multi-select support. */
export function WorkList({ query, selection, empty, subtitle, onTotal }: WorkListProps) {
  const list = useInfiniteQuery({
    queryKey: ["works", query],
    queryFn: ({ pageParam }) => api.works({ ...query, offset: pageParam, limit: PAGE }),
    initialPageParam: 0,
    getNextPageParam: (last, all) => {
      const loaded = all.reduce((n, p) => n + p.works.length, 0)
      return loaded < last.total ? loaded : undefined
    },
  })
  const works = useMemo(() => list.data?.pages.flatMap((p) => p.works) ?? [], [list.data])
  const total = list.data?.pages[0]?.total

  useEffect(() => {
    if (total !== undefined) onTotal?.(total)
  }, [total, onTotal])

  if (list.isLoading) return <GridSkeleton />
  if (works.length === 0) return <>{empty}</>

  return (
    <>
      <CardGrid>
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
      <LoadMore query={list} />
      <SelectionBar selection={selection} allIds={works.map((w) => w.id)} />
    </>
  )
}
