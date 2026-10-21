import { Loader2Icon } from "lucide-react"
import { useEffect, useRef } from "react"

interface LoadMoreProps {
  query: { hasNextPage: boolean; isFetchingNextPage: boolean; fetchNextPage: () => unknown }
}

/** Sentinel below an infinite list that fetches the next page as it nears the viewport. */
export function LoadMore({ query }: LoadMoreProps) {
  const sentinel = useRef<HTMLDivElement>(null)
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = query
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

  return (
    <div ref={sentinel} className="flex h-16 items-center justify-center text-muted-foreground">
      {isFetchingNextPage && <Loader2Icon className="size-5 animate-spin" />}
    </div>
  )
}
