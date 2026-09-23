import { createContext, useContext, useState, type ReactNode } from "react"

import { readStorage, writeStorage } from "@/lib/storage"

const KEY = "mangayomi.library"

interface LibraryFilter {
  /** 0 means every library. */
  libraryId: number
  setLibraryId: (id: number) => void
}

const Ctx = createContext<LibraryFilter>({ libraryId: 0, setLibraryId: () => {} })

export function LibraryFilterProvider({ children }: { children: ReactNode }) {
  const [libraryId, setId] = useState(() => readStorage(KEY, { id: 0 }).id)
  const setLibraryId = (id: number) => {
    setId(id)
    writeStorage(KEY, { id })
  }
  return <Ctx.Provider value={{ libraryId, setLibraryId }}>{children}</Ctx.Provider>
}

// oxlint-disable-next-line react/only-export-components
export function useLibraryFilter() {
  return useContext(Ctx)
}
