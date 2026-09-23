import { ListChecksIcon, SearchIcon, SearchXIcon } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { useSearchParams } from "react-router"

import { LibrarySelect, useActiveLibrary } from "@/components/library-select"
import { EmptyState, PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { WorkList } from "@/components/work-list"
import { useDebounce } from "@/hooks/use-debounce"
import { useSelection } from "@/hooks/use-selection"
import type { WorkQuery } from "@/lib/api"

type Status = NonNullable<WorkQuery["status"]>
type Sort = NonNullable<WorkQuery["sort"]>

export function BrowsePage() {
  const { t } = useTranslation()
  const library = useActiveLibrary()
  const [params, setParams] = useSearchParams()
  const [search, setSearch] = useState(params.get("q") ?? "")
  const q = useDebounce(search)
  const status = (params.get("status") ?? "") as Status
  const sort = (params.get("sort") ?? "title") as Sort
  const selection = useSelection()
  const [total, setTotal] = useState<number>()

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next, { replace: true })
  }

  return (
    <>
      <PageHeader
        title={t("browse.title")}
        description={total !== undefined ? t("common.works", { count: total }) : undefined}
        actions={
          <Button
            variant={selection.active ? "secondary" : "outline"}
            onClick={selection.active ? selection.stop : selection.start}
          >
            <ListChecksIcon />
            {t("common.select")}
          </Button>
        }
      />

      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("browse.searchPlaceholder")}
            className="pl-8"
            type="search"
          />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <Select value={status || "all"} onValueChange={(v) => setParam("status", v === "all" ? "" : v)}>
            <SelectTrigger className="w-full sm:w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("browse.statusAll")}</SelectItem>
              <SelectItem value="unread">{t("browse.statusUnread")}</SelectItem>
              <SelectItem value="reading">{t("browse.statusReading")}</SelectItem>
              <SelectItem value="completed">{t("browse.statusCompleted")}</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sort} onValueChange={(v) => setParam("sort", v === "title" ? "" : v)}>
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="title">{t("browse.sortTitle")}</SelectItem>
              <SelectItem value="added">{t("browse.sortAdded")}</SelectItem>
              <SelectItem value="recent">{t("browse.sortRecent")}</SelectItem>
            </SelectContent>
          </Select>
          <div className="col-span-2">
            <LibrarySelect />
          </div>
        </div>
      </div>

      <WorkList
        query={{ library, q, status, sort }}
        selection={selection}
        onTotal={setTotal}
        empty={<EmptyState icon={<SearchXIcon />} title={t("browse.empty")} />}
      />
    </>
  )
}
