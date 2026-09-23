import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useLibraryFilter } from "@/hooks/use-library-filter"
import { api } from "@/lib/api"

/** Global library filter; hidden when there is only one library. */
export function LibrarySelect() {
  const { t } = useTranslation()
  const { libraryId, setLibraryId } = useLibraryFilter()
  const { data } = useQuery({ queryKey: ["libraries"], queryFn: api.libraries })
  const libs = data?.libraries ?? []
  if (libs.length < 2) return null

  const value = libs.some((l) => l.id === libraryId) ? String(libraryId) : "0"
  return (
    <Select value={value} onValueChange={(v) => setLibraryId(Number(v))}>
      <SelectTrigger className="w-full sm:w-44">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="0">{t("libraryFilter.all")}</SelectItem>
        {libs.map((l) => (
          <SelectItem key={l.id} value={String(l.id)}>
            {l.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

/** The effective library id: the stored filter if that library still exists. */
// oxlint-disable-next-line react/only-export-components
export function useActiveLibrary(): number {
  const { libraryId } = useLibraryFilter()
  const { data } = useQuery({ queryKey: ["libraries"], queryFn: api.libraries })
  if (!data) return 0
  return data.libraries.some((l) => l.id === libraryId) ? libraryId : 0
}
