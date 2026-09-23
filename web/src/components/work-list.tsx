import { useInfiniteQuery } from "@tanstack/react-query"
import { Loader2Icon } from "lucide-react"
import { useEffect, useMemo, useRef, type ReactNode } from "react"

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

  const sentinel = useRef<HTMLDivElement>(null)
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = list
  useEffect(() => {
    const el = sentinel.current
    if (!el || !hasNextPage) return
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !isFetchingNextPage) fetchNextPage()
      },
      { rootMargin: "800px" },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

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
      <div ref={sentinel} className="flex h-16 items-center justify-center text-muted-foreground">
        {isFetchingNextPage && <Loader2Icon className="size-5 animate-spin" />}
      </div>
      <SelectionBar selection={selection} allIds={works.map((w) => w.id)} />
    </>
  )
}
