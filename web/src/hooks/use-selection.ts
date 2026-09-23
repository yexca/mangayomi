import { useCallback, useState } from "react"

export interface Selection {
  active: boolean
  ids: Set<number>
  start: () => void
  stop: () => void
  toggle: (id: number) => void
  setMany: (ids: number[]) => void
}

export function useSelection(): Selection {
  const [active, setActive] = useState(false)
  const [ids, setIds] = useState<Set<number>>(() => new Set())

  const start = useCallback(() => setActive(true), [])
  const stop = useCallback(() => {
    setActive(false)
    setIds(new Set())
  }, [])
  const toggle = useCallback((id: number) => {
    setIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])
  const setMany = useCallback((list: number[]) => setIds(new Set(list)), [])

  return { active, ids, start, stop, toggle, setMany }
}
