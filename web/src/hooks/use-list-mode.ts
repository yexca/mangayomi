import { useCallback, useSyncExternalStore } from "react"

import { readStorage, writeStorage } from "@/lib/storage"

/** How long lists load: continuously while scrolling, or one page at a time. */
export type ListMode = "scroll" | "pages"

const KEY = "mangayomi.lists"

let current: ListMode = readStorage(KEY, { mode: "scroll" }).mode === "pages" ? "pages" : "scroll"
const listeners = new Set<() => void>()

function subscribe(fn: () => void) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function useListMode() {
  const mode = useSyncExternalStore(subscribe, () => current)
  const setMode = useCallback((next: ListMode) => {
    current = next
    writeStorage(KEY, { mode: next })
    listeners.forEach((l) => l())
  }, [])
  return [mode, setMode] as const
}
