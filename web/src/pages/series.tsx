import { useInfiniteQuery, useQuery } from "@tanstack/react-query"
import {
  BookOpenIcon,
  ListChecksIcon,
  MoreHorizontalIcon,
  PlayIcon,
  SearchIcon,
} from "lucide-react"
import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { Link, useNavigate, useSearchParams } from "react-router"

import { DeleteDialog } from "@/components/delete-dialog"
import { GroupCard } from "@/components/group-card"
import { GroupMenuItems } from "@/components/group-actions"
import { LoadMore } from "@/components/load-more"
import { LibrarySelect, useActiveLibrary } from "@/components/library-select"
import { EmptyState, PageHeader } from "@/components/page-header"
import { SelectionBar } from "@/components/selection-bar"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { CardGrid, WorkCard } from "@/components/work-card"
import { useDebounce } from "@/hooks/use-debounce"
import { useSelection } from "@/hooks/use-selection"
import { api, type DeleteTarget } from "@/lib/api"
import { authorLink, nextToRead, seriesLink } from "@/lib/links"
import { GridSkeleton } from "@/pages/home"

const PAGE = 60

export function SeriesListPage() {
  const { t } = useTranslation()
  const library = useActiveLibrary()
  const [search, setSearch] = useState("")
  const q = useDebounce(search)
  const [sort, setSort] = useState("name")
  const [deleting, setDeleting] = useState<DeleteTarget | null>(null)
  const list = useInfiniteQuery({
    queryKey: ["series", "list", library, q, sort],
    queryFn: ({ pageParam }) => api.series({ library, q, sort, offset: pageParam, limit: PAGE }),
    initialPageParam: 0,
    getNextPageParam: (last, all) => {
      const loaded = all.reduce((n, p) => n + p.series.length, 0)
      return loaded < last.total ? loaded : undefined
    },
  })
  const series = useMemo(() => list.data?.pages.flatMap((p) => p.series) ?? [], [list.data])
  const total = list.data?.pages[0]?.total ?? 0

  return (
    <>
      <PageHeader
        title={t("series.title")}
        description={list.data ? t("common.series", { count: total }) : undefined}
      />
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("series.searchPlaceholder")}
            className="pl-8"
            type="search"
          />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <Select value={sort} onValueChange={setSort}>
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name">{t("browse.sortName")}</SelectItem>
              <SelectItem value="added">{t("browse.sortAdded")}</SelectItem>
            </SelectContent>
          </Select>
          <LibrarySelect />
        </div>
      </div>

      {list.isLoading && <GridSkeleton />}
      {list.data && series.length === 0 && <EmptyState icon={<BookOpenIcon />} title={t("series.empty")} />}
      <CardGrid className="pt-1.5">
        {series.map((s) => {
          const target: DeleteTarget = { series: [{ libraryId: library, author: s.author, series: s.series }] }
          return (
            <GroupCard
              key={`${s.author}\u0000${s.series}`}
              to={seriesLink(s.author, s.series, library)}
              coverId={s.coverId}
              coverVersion={s.coverVersion}
              title={s.series}
              subtitle={s.author || undefined}
              count={s.count}
              completed={s.completed}
              menu={<GroupMenuItems target={target} deleteLabel={t("series.deleteSeries")} onDelete={setDeleting} />}
            />
          )
        })}
      </CardGrid>
      <LoadMore query={list} />
      <DeleteDialog target={deleting} onClose={() => setDeleting(null)} />
    </>
  )
}

export function SeriesDetailPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const author = params.get("author") ?? ""
  const series = params.get("series") ?? ""
  const library = Number(params.get("library") ?? 0)
  const selection = useSelection()
  const [deleting, setDeleting] = useState<DeleteTarget | null>(null)

  const list = useQuery({
    queryKey: ["works", { library, author, series, sort: "title", all: true }],
    queryFn: () => api.works({ library, author, series, sort: "title", limit: 500 }),
  })
  const works = list.data?.works ?? []
  const target: DeleteTarget = { series: [{ libraryId: library, author, series }] }
  const next = nextToRead(works)
  const done = works.filter((w) => w.progress?.completed).length

  return (
    <>
      <PageHeader
        title={series}
        description={
          <>
            {author && (
              <>
                <Link to={authorLink(author, library)} className="hover:text-foreground hover:underline">
                  {author}
                </Link>
                {" · "}
              </>
            )}
            {t("common.works", { count: works.length })}
            {done > 0 && ` · ${t("series.readCount", { read: done, total: works.length })}`}
          </>
        }
        actions={
          <>
            {next && (
              <Button asChild>
                <Link to={`/read/${next.id}`}>
                  <PlayIcon />
                  {next.progress && !next.progress.completed ? t("series.continueReading") : t("series.startReading")}
                </Link>
              </Button>
            )}
            <Button
              variant={selection.active ? "secondary" : "outline"}
              onClick={selection.active ? selection.stop : selection.start}
            >
              <ListChecksIcon />
              {t("common.select")}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" aria-label={t("common.more")}>
                  <MoreHorizontalIcon />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <GroupMenuItems target={target} deleteLabel={t("series.deleteSeries")} onDelete={setDeleting} />
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      />
      {list.isLoading && <GridSkeleton />}
      <CardGrid>
        {works.map((w) => (
          <WorkCard
            key={w.id}
            work={w}
            subtitle={t("common.pages", { count: w.pageCount })}
            selecting={selection.active}
            selected={selection.ids.has(w.id)}
            onToggle={selection.toggle}
          />
        ))}
      </CardGrid>
      <SelectionBar selection={selection} allIds={works.map((w) => w.id)} />
      <DeleteDialog
        target={deleting}
        onClose={() => setDeleting(null)}
        onDeleted={(res) => res.deleted.length >= works.length && navigate("/series", { replace: true })}
      />
    </>
  )
}
