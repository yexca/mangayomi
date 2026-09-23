import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect, useRef } from "react"

import { api } from "@/lib/api"

/** Polls scan progress while any scan runs, refreshing lists when one finishes. */
export function useScanStatus() {
  const qc = useQueryClient()
  const query = useQuery({
    queryKey: ["scan-status"],
    queryFn: api.scanStatus,
    refetchInterval: (q) => (q.state.data?.scans.some((s) => s.running) ? 1500 : false),
  })
  const running = query.data?.scans.some((s) => s.running) ?? false
  const wasRunning = useRef(running)

  useEffect(() => {
    if (wasRunning.current && !running) {
      qc.invalidateQueries({ predicate: (q) => q.queryKey[0] !== "scan-status" && q.queryKey[0] !== "auth" })
    }
    wasRunning.current = running
  }, [running, qc])

  return query
}
