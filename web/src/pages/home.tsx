import { useQuery } from "@tanstack/react-query"
import { ChevronRightIcon, FolderPlusIcon, LibraryIcon } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router"

import { LibrarySelect, useActiveLibrary } from "@/components/library-select"
import { EmptyState, PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { CardGrid, WorkCard } from "@/components/work-card"
import { api } from "@/lib/api"

export function HomePage() {
  const { t } = useTranslation()
  const library = useActiveLibrary()
  const libs = useQuery({ queryKey: ["libraries"], queryFn: api.libraries })
  const home = useQuery({ queryKey: ["home", library], queryFn: () => api.home(library) })

  if (libs.data && libs.data.libraries.length === 0) {
    return (
      <>
        <PageHeader title={t("nav.home")} />
        <EmptyState
          icon={<FolderPlusIcon />}
          title={t("home.emptyTitle")}
          description={t("home.emptyDescription")}
          action={
            <Button asChild>
              <Link to="/settings/libraries/new">{t("home.addLibrary")}</Link>
            </Button>
          }
        />
      </>
    )
  }

  const data = home.data
  return (
    <>
      <PageHeader title={t("nav.home")} actions={<LibrarySelect />} />

      {home.isLoading && <GridSkeleton />}

      {data && data.totalWorks === 0 && (
        <EmptyState icon={<LibraryIcon />} title={t("home.noWorksTitle")} description={t("home.noWorksDescription")} />
      )}

      {data && data.continueReading.length > 0 && (
        <section className="mb-10">
          <h2 className="mb-4 text-lg font-semibold tracking-tight">{t("home.continueReading")}</h2>
          <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:gap-4 sm:px-6 md:mx-0 md:px-0">
            {data.continueReading.map((w) => (
              <div key={w.id} className="w-28 shrink-0 snap-start sm:w-36">
                <WorkCard
                  work={w}
                  subtitle={t("work.pageOf", { page: (w.progress?.page ?? 0) + 1, total: w.pageCount })}
                />
              </div>
            ))}
          </div>
        </section>
      )}

      {data && data.recentlyAdded.length > 0 && (
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold tracking-tight">{t("home.recentlyAdded")}</h2>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/library?sort=added">
                {t("home.viewAll")}
                <ChevronRightIcon />
              </Link>
            </Button>
          </div>
          <CardGrid>
            {data.recentlyAdded.map((w) => (
              <WorkCard key={w.id} work={w} />
            ))}
          </CardGrid>
        </section>
      )}
    </>
  )
}

export function GridSkeleton({ count = 12 }: { count?: number }) {
  return (
    <CardGrid>
      {Array.from({ length: count }, (_, i) => (
        <div key={i}>
          <Skeleton className="aspect-[2/3] rounded-lg" />
          <Skeleton className="mt-2 h-4 w-3/4" />
          <Skeleton className="mt-1.5 h-3 w-1/2" />
        </div>
      ))}
    </CardGrid>
  )
}
