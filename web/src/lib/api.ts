export type ReadingDirection = "rtl" | "ltr"
export type WorkKind = "archive" | "folder"

export interface Library {
  id: number
  name: string
  path: string
  pattern: string
  excludes: string[]
  readingDirection: ReadingDirection
  scanInterval: number
  lastScanAt: number | null
  createdAt: number
  workCount: number
}

export interface LibraryInput {
  name: string
  path: string
  pattern: string
  excludes: string[]
  readingDirection: ReadingDirection
  scanInterval: number
}

export interface Progress {
  page: number
  completed: boolean
  updatedAt: number
}

export interface Work {
  id: number
  libraryId: number
  relPath: string
  kind: WorkKind
  title: string
  author: string
  series: string
  pageCount: number
  size: number
  mtime: number
  addedAt: number
  progress: Progress | null
}

export interface WorkRef {
  id: number
  title: string
}

export interface WorkDetail extends Work {
  path: string
  libraryName: string
  readingDirection: ReadingDirection
  prev: WorkRef | null
  next: WorkRef | null
}

export interface PageDim {
  w: number
  h: number
}

export interface SeriesGroup {
  author: string
  series: string
  count: number
  completed: number
  coverId: number
  coverVersion: number
  lastAddedAt: number
}

export interface AuthorGroup {
  author: string
  count: number
  seriesCount: number
  completed: number
  coverId: number
  coverVersion: number
  lastAddedAt: number
}

export interface ScanStatus {
  libraryId: number
  running: boolean
  scanned: number
  added: number
  updated: number
  removed: number
  startedAt: number
  finishedAt?: number
  error?: string
}

export interface BrowseResult {
  path: string
  rel: string
  base: string
  parent: string | null
  dirs: { name: string; path: string; rel: string }[]
}

export interface PreviewItem {
  relPath: string
  kind: WorkKind
  title: string
  author: string
  series: string
}

export interface DeleteTarget {
  workIds?: number[]
  series?: { libraryId?: number; author: string; series: string }[]
  authors?: { libraryId?: number; author: string }[]
}

export interface DeletePlan {
  token: string
  expiresAt: number
  items: {
    id: number
    title: string
    author: string
    series: string
    kind: WorkKind
    path: string
    size: number
    files: number
  }[]
  emptyDirs: string[]
  totalSize: number
  totalFiles: number
}

export interface DeleteResult {
  deleted: number[]
  failed: { id: number; path: string; error: string }[]
}

export interface WorkQuery {
  library?: number
  author?: string
  series?: string
  q?: string
  status?: "" | "unread" | "reading" | "completed"
  sort?: "title" | "added" | "recent"
  offset?: number
  limit?: number
}

export class ApiError extends Error {
  status: number
  code: string

  constructor(status: number, code: string, message: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

let unauthorizedHandler: (() => void) | undefined

export function onUnauthorized(fn: () => void) {
  unauthorizedHandler = fn
}

async function request<T>(method: string, url: string, body?: unknown): Promise<T> {
  const init: RequestInit = { method, credentials: "same-origin" }
  if (method !== "GET") {
    init.headers = { "Content-Type": "application/json" }
    init.body = JSON.stringify(body ?? {})
  }
  let res: Response
  try {
    res = await fetch(url, init)
  } catch {
    throw new ApiError(0, "network", "Cannot reach the server.")
  }
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string; code?: string }
    if (res.status === 401 && !url.startsWith("/api/auth/")) unauthorizedHandler?.()
    throw new ApiError(res.status, data.code ?? "internal", data.error ?? res.statusText)
  }
  return (await res.json()) as T
}

function qs(params: Record<string, string | number | undefined | null>) {
  const sp = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue
    if (typeof v === "number" && v === 0 && k === "library") continue
    sp.set(k, String(v))
  }
  const s = sp.toString()
  return s ? `?${s}` : ""
}

export const api = {
  authStatus: () => request<{ setupRequired: boolean; authenticated: boolean }>("GET", "/api/auth/status"),
  setup: (password: string) => request("POST", "/api/auth/setup", { password }),
  login: (password: string) => request("POST", "/api/auth/login", { password }),
  logout: () => request("POST", "/api/auth/logout"),
  changePassword: (current: string, next: string) => request("POST", "/api/auth/password", { current, next }),

  browse: (path?: string, base?: string) => request<BrowseResult>("GET", `/api/fs/browse${qs({ path, base })}`),

  libraries: () => request<{ libraries: Library[]; dataDir: string }>("GET", "/api/libraries"),
  library: (id: number) => request<Library>("GET", `/api/libraries/${id}`),
  createLibrary: (input: LibraryInput) => request<Library>("POST", "/api/libraries", input),
  updateLibrary: (id: number, input: LibraryInput) => request<Library>("PUT", `/api/libraries/${id}`, input),
  deleteLibrary: (id: number) => request("DELETE", `/api/libraries/${id}`),
  previewLibrary: (input: Pick<LibraryInput, "path" | "pattern" | "excludes">) =>
    request<{ items: PreviewItem[]; truncated: boolean }>("POST", "/api/libraries/preview", input),
  scanLibrary: (id: number) => request<{ started: boolean }>("POST", `/api/libraries/${id}/scan`),
  scanAll: () => request("POST", "/api/libraries/scan"),
  scanStatus: () => request<{ scans: ScanStatus[] }>("GET", "/api/scan/status"),

  home: (library?: number) =>
    request<{ continueReading: Work[]; recentlyAdded: Work[]; totalWorks: number }>("GET", `/api/home${qs({ library })}`),
  works: (q: WorkQuery) => request<{ works: Work[]; total: number }>("GET", `/api/works${qs({ ...q })}`),
  work: (id: number) => request<WorkDetail>("GET", `/api/works/${id}`),
  pages: (id: number) => request<{ pages: PageDim[] }>("GET", `/api/works/${id}/pages`),
  setProgress: (id: number, page: number, completed: boolean) =>
    request("PUT", `/api/works/${id}/progress`, { page, completed }),
  markCompleted: (target: DeleteTarget, completed: boolean) =>
    request<{ updated: number }>("POST", "/api/progress/batch", { ...target, completed }),
  series: (p: { library?: number; author?: string; q?: string; sort?: string }) =>
    request<{ series: SeriesGroup[] }>("GET", `/api/series${qs(p)}`),
  authors: (p: { library?: number; q?: string; sort?: string }) =>
    request<{ authors: AuthorGroup[] }>("GET", `/api/authors${qs(p)}`),

  deletePreview: (target: DeleteTarget) => request<DeletePlan>("POST", "/api/delete/preview", target),
  deleteConfirm: (token: string) => request<DeleteResult>("POST", "/api/delete/confirm", { token }),
}

export const coverUrl = (id: number, version: number) => `/api/works/${id}/cover?v=${version}`
export const pageUrl = (id: number, page: number, version: number) => `/api/works/${id}/pages/${page}?v=${version}`
