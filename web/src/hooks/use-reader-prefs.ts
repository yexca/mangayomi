import { useCallback, useSyncExternalStore } from "react"

import type { ReadingDirection } from "@/lib/api"
import { readStorage, writeStorage } from "@/lib/storage"

export type PageLayout = "auto" | "single" | "double"
export type PageFit = "contain" | "width"

export interface ReaderPrefs {
  layout: PageLayout
  fit: PageFit
  coverAlone: boolean
  /** Per-series (or per-work) reading direction overrides. */
  directions: Record<string, ReadingDirection>
}

const KEY = "mangayomi.reader"
const defaults: ReaderPrefs = { layout: "auto", fit: "contain", coverAlone: true, directions: {} }

let current = readStorage(KEY, defaults)
const listeners = new Set<() => void>()

function subscribe(fn: () => void) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function useReaderPrefs() {
  const prefs = useSyncExternalStore(subscribe, () => current)
  const update = useCallback((patch: Partial<ReaderPrefs>) => {
    current = { ...current, ...patch }
    writeStorage(KEY, current)
    listeners.forEach((l) => l())
  }, [])
  return [prefs, update] as const
}

/** Key under which a reading-direction override is remembered. */
export function directionKey(work: { libraryId: number; id: number; author: string; series: string }) {
  return work.series ? `${work.libraryId}:${work.author}:${work.series}` : `work:${work.id}`
}
