import {
  keepPreviousData,
  useInfiniteQuery,
  useQuery,
  useQueryClient,
  type InfiniteData,
  type QueryKey,
} from "@tanstack/react-query"
import { useCallback, useEffect, useMemo, useState } from "react"
import { useSearchParams } from "react-router"

import { useListMode, type ListMode } from "@/hooks/use-list-mode"

export const PAGE_SIZE = 60

/**
 * Pages an infinite list keeps in the cache once it is left. Mutations and
 * finished scans invalidate every list, and an infinite query refetches each
 * cached page in turn; the cap bounds that work to a few requests no matter how
 * far the list was scrolled.
 */
const KEEP_PAGES = 5

export interface Page<T> {
  items: T[]
  total: number
}

export interface PagedList<T> {
  mode: ListMode
  items: T[]
  total: number | undefined
  isLoading: boolean
  /** Infinite mode: the sentinel's view of the query. */
  scroll: { hasNextPage: boolean; isFetchingNextPage: boolean; fetchNextPage: () => unknown }
  /** Page mode: the 1-based page shown, the number of pages, and navigation. */
  page: number
  pageCount: number
  /** True while a different page than the one shown is loading. */
  isChangingPage: boolean
  setPage: (page: number) => void
}

/**
 * A list that loads either while scrolling or one page at a time, following
 * the list mode preference. In page mode the page number lives in the `page`
 * search parameter, so back navigation returns to it; it resets to the first
 * page when the key changes.
 */
export function usePagedList<T>(key: QueryKey, fetchPage: (offset: number, limit: number) => Promise<Page<T>>): PagedList<T> {
  const [mode] = useListMode()
  const qc = useQueryClient()
  const [params, setParams] = useSearchParams()
  const keyStr = JSON.stringify(key)

  // A new key (another filter or sort) starts again at the first page. Until
  // the first page has loaded the key may still settle (the library filter
  // resolves once libraries load), so only a change after that resets.
  const [anchor, setAnchor] = useState(keyStr)
  const [settled, setSettled] = useState(false)
  const [reset, setReset] = useState(false)
  if (anchor !== keyStr) {
    setAnchor(keyStr)
    if (settled) setReset(true)
  }
  const urlPage = Math.max(1, Math.floor(Number(params.get("page"))) || 1)
  const page = reset ? 1 : urlPage

  const infinite = useInfiniteQuery({
    queryKey: [...key, "scroll"],
    queryFn: ({ pageParam }) => fetchPage(pageParam, PAGE_SIZE),
    initialPageParam: 0,
    getNextPageParam: (last, all) => {
      const loaded = all.reduce((n, p) => n + p.items.length, 0)
      return loaded < last.total ? loaded : undefined
    },
    enabled: mode === "scroll",
  })
  const paged = useQuery({
    queryKey: [...key, "page", page],
    queryFn: () => fetchPage((page - 1) * PAGE_SIZE, PAGE_SIZE),
    placeholderData: keepPreviousData,
    enabled: mode === "pages",
  })

  const goTo = useCallback(
    (next: number, replace: boolean) => {
      const p = new URLSearchParams(params)
      if (next > 1) p.set("page", String(next))
      else p.delete("page")
      setParams(p, { replace })
    },
    [params, setParams],
  )
  const setPage = useCallback(
    (next: number) => {
      setReset(false)
      goTo(next, false)
      window.scrollTo({ top: 0 })
    },
    [goTo],
  )

  const loaded = mode === "scroll" ? infinite.isSuccess : paged.isSuccess && !paged.isPlaceholderData
  if (loaded && !settled) setSettled(true)

  // Drop the previous filter's page from the URL.
  useEffect(() => {
    if (reset && params.has("page")) goTo(1, true)
  }, [reset, params, goTo])

  // Leaving an infinite list (or changing its filter) trims its cache.
  useEffect(
    () => () => {
      const scrollKey = [...(JSON.parse(keyStr) as unknown[]), "scroll"]
      const state = qc.getQueryState<InfiniteData<Page<T>, number>>(scrollKey)
      if (!state?.data || state.data.pages.length <= KEEP_PAGES) return
      qc.setQueryData<InfiniteData<Page<T>, number>>(
        scrollKey,
        (d) => d && { pages: d.pages.slice(0, KEEP_PAGES), pageParams: d.pageParams.slice(0, KEEP_PAGES) },
        { updatedAt: state.dataUpdatedAt },
      )
    },
    [qc, keyStr],
  )

  const pages = infinite.data?.pages
  const scrollItems = useMemo(() => pages?.flatMap((p) => p.items) ?? [], [pages])
  const total = mode === "scroll" ? pages?.[0]?.total : paged.data?.total
  const pageCount = Math.max(1, Math.ceil((total ?? 0) / PAGE_SIZE))

  // A page past the end (works were deleted, or a stale link) moves to the last one.
  useEffect(() => {
    if (mode === "pages" && loaded && page > pageCount) goTo(pageCount, true)
  }, [mode, loaded, page, pageCount, goTo])

  return {
    mode,
    items: mode === "scroll" ? scrollItems : (paged.data?.items ?? []),
    total,
    isLoading: mode === "scroll" ? infinite.isLoading : paged.isLoading,
    scroll: infinite,
    page: Math.min(page, pageCount),
    pageCount,
    isChangingPage: paged.isPlaceholderData,
    setPage,
  }
}
