import { useQuery } from "@tanstack/react-query"
import { ListChecksIcon, MoreHorizontalIcon, SearchIcon, UsersIcon } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { useNavigate, useSearchParams } from "react-router"

import { DeleteDialog } from "@/components/delete-dialog"
import { GroupCard } from "@/components/group-card"
import { GroupMenuItems } from "@/components/group-actions"
import { LibrarySelect, useActiveLibrary } from "@/components/library-select"
import { EmptyState, PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { CardGrid } from "@/components/work-card"
import { WorkList } from "@/components/work-list"
import { useDebounce } from "@/hooks/use-debounce"
import { useSelection } from "@/hooks/use-selection"
import { api, type DeleteTarget } from "@/lib/api"
import { GridSkeleton } from "@/pages/home"
import { authorLink, seriesLink } from "@/lib/links"

export function AuthorsListPage() {
  const { t } = useTranslation()
  const library = useActiveLibrary()
  const [search, setSearch] = useState("")
  const q = useDebounce(search)
  const [sort, setSort] = useState("name")
  const [deleting, setDeleting] = useState<DeleteTarget | null>(null)
  const list = useQuery({
    queryKey: ["authors", library, q, sort],
    queryFn: () => api.authors({ library, q, sort }),
  })
  const authors = list.data?.authors ?? []

  return (
    <>
      <PageHeader title={t("authors.title")} description={list.data ? String(authors.length) : undefined} />
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("authors.searchPlaceholder")}
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
      {list.data && authors.length === 0 && <EmptyState icon={<UsersIcon />} title={t("authors.empty")} />}
      <CardGrid className="pt-1.5">
        {authors.map((a) => (
          <GroupCard
            key={a.author}
            to={authorLink(a.author, library)}
            coverId={a.coverId}
            coverVersion={a.coverVersion}
            title={a.author}
            subtitle={[
              a.seriesCount > 0 ? t("common.series", { count: a.seriesCount }) : null,
              t("common.works", { count: a.count }),
            ]
              .filter(Boolean)
              .join(" · ")}
            count={a.count}
            completed={a.completed}
            menu={
              <GroupMenuItems
                target={{ authors: [{ libraryId: library, author: a.author }] }}
                deleteLabel={t("authors.deleteAuthor")}
                onDelete={setDeleting}
              />
            }
          />
        ))}
      </CardGrid>
      <DeleteDialog target={deleting} onClose={() => setDeleting(null)} />
    </>
  )
}

export function AuthorDetailPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const author = params.get("author") ?? ""
  const library = Number(params.get("library") ?? 0)
  const selection = useSelection()
  const [deleting, setDeleting] = useState<DeleteTarget | null>(null)
  const [standaloneCount, setStandaloneCount] = useState<number>()

  const series = useQuery({
    queryKey: ["series", library, "", "name", author],
    queryFn: () => api.series({ library, author }),
  })
  const list = series.data?.series ?? []
  const target: DeleteTarget = { authors: [{ libraryId: library, author }] }

  return (
    <>
      <PageHeader
        title={author}
        actions={
          <>
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
                <GroupMenuItems target={target} deleteLabel={t("authors.deleteAuthor")} onDelete={setDeleting} />
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      />

      {series.isLoading && <GridSkeleton count={6} />}
      {list.length > 0 && (
        <section className="mb-10">
          <h2 className="mb-4 text-lg font-semibold tracking-tight">{t("authors.seriesHeading")}</h2>
          <CardGrid className="pt-1.5">
            {list.map((s) => (
              <GroupCard
                key={s.series}
                to={seriesLink(s.author, s.series, library)}
                coverId={s.coverId}
                coverVersion={s.coverVersion}
                title={s.series}
                count={s.count}
                completed={s.completed}
                menu={
                  <GroupMenuItems
                    target={{ series: [{ libraryId: library, author, series: s.series }] }}
                    deleteLabel={t("series.deleteSeries")}
                    onDelete={setDeleting}
                  />
                }
              />
            ))}
          </CardGrid>
        </section>
      )}

      <section className={standaloneCount === 0 ? "hidden" : undefined}>
        {list.length > 0 && <h2 className="mb-4 text-lg font-semibold tracking-tight">{t("authors.standalone")}</h2>}
        <WorkList
          query={{ library, author, series: "", sort: "title" }}
          selection={selection}
          onTotal={setStandaloneCount}
          subtitle={(w) => t("common.pages", { count: w.pageCount })}
        />
      </section>

      <DeleteDialog
        target={deleting}
        onClose={() => setDeleting(null)}
        onDeleted={() => deleting?.authors && navigate("/authors", { replace: true })}
      />
    </>
  )
}
