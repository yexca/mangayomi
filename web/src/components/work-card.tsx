import { CheckIcon } from "lucide-react"
import { Link } from "react-router"

import { Cover } from "@/components/cover"
import type { Work } from "@/lib/api"
import { cn } from "@/lib/utils"

interface WorkCardProps {
  work: Work
  selecting?: boolean
  selected?: boolean
  onToggle?: (id: number) => void
  /** What to show under the title. Defaults to author · series. */
  subtitle?: string
}

export function WorkCard({ work, selecting, selected, onToggle, subtitle }: WorkCardProps) {
  const progress = work.progress
  const pct = progress
    ? progress.completed
      ? 100
      : Math.round(((progress.page + 1) / Math.max(work.pageCount, 1)) * 100)
    : 0
  const sub = subtitle ?? [work.author, work.series].filter(Boolean).join(" · ")

  const body = (
    <>
      <div className="relative">
        <Cover
          id={work.id}
          version={work.mtime}
          alt={work.title}
          className={cn(
            "ring-1 ring-foreground/5 transition group-hover:ring-foreground/20",
            selected && "ring-2 ring-primary group-hover:ring-primary",
          )}
        />
        {progress && !progress.completed && (
          <div className="absolute inset-x-0 bottom-0 h-1 overflow-hidden rounded-b-lg bg-black/30">
            <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
          </div>
        )}
        {progress?.completed && !selecting && (
          <div className="absolute top-1.5 right-1.5 flex size-5 items-center justify-center rounded-full bg-background/90 text-foreground shadow-sm">
            <CheckIcon className="size-3" strokeWidth={3} />
          </div>
        )}
        {selecting && (
          <div
            className={cn(
              "absolute top-1.5 right-1.5 flex size-5 items-center justify-center rounded-full border-2 shadow-sm transition",
              selected ? "border-primary bg-primary text-primary-foreground" : "border-white/90 bg-black/20",
            )}
          >
            {selected && <CheckIcon className="size-3" strokeWidth={3} />}
          </div>
        )}
      </div>
      <div className="mt-2 space-y-0.5 px-0.5">
        <p className="line-clamp-2 text-sm leading-snug font-medium">{work.title}</p>
        {sub && <p className="truncate text-xs text-muted-foreground">{sub}</p>}
      </div>
    </>
  )

  if (selecting) {
    return (
      <button type="button" className="group block w-full text-left" onClick={() => onToggle?.(work.id)}>
        {body}
      </button>
    )
  }
  return (
    <Link to={`/works/${work.id}`} className="group block">
      {body}
    </Link>
  )
}

export function CardGrid({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "grid grid-cols-[repeat(auto-fill,minmax(7.5rem,1fr))] gap-x-3 gap-y-5 sm:grid-cols-[repeat(auto-fill,minmax(9.5rem,1fr))] sm:gap-x-4",
        className,
      )}
    >
      {children}
    </div>
  )
}
