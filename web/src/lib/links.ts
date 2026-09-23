import type { Work } from "@/lib/api"

export function seriesLink(author: string, series: string, library: number) {
  const sp = new URLSearchParams({ author, series })
  if (library) sp.set("library", String(library))
  return `/series/view?${sp}`
}

export function authorLink(author: string, library: number) {
  const sp = new URLSearchParams({ author })
  if (library) sp.set("library", String(library))
  return `/authors/view?${sp}`
}

/** The work to open when pressing "read" on a group: the first not yet finished. */
export function nextToRead(works: Work[]): Work | undefined {
  return works.find((w) => w.progress && !w.progress.completed) ?? works.find((w) => !w.progress?.completed) ?? works[0]
}
