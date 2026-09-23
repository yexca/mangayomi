import { MoreHorizontalIcon } from "lucide-react"
import type { ReactNode } from "react"
import { Link } from "react-router"

import { Cover } from "@/components/cover"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface GroupCardProps {
  to: string
  coverId: number
  coverVersion: number
  title: string
  subtitle?: string
  count: number
  completed: number
  menu?: ReactNode
}

/** A stacked-cover card for a series or an author. */
export function GroupCard({ to, coverId, coverVersion, title, subtitle, count, completed, menu }: GroupCardProps) {
  const allRead = count > 0 && completed === count
  return (
    <div className="group relative">
      <Link to={to} className="block">
        <div className="relative">
          <div className="absolute inset-x-2 -top-1.5 h-4 rounded-t-lg bg-foreground/10" />
          <div className="absolute inset-x-1 -top-0.75 h-4 rounded-t-lg bg-foreground/15" />
          <Cover
            id={coverId}
            version={coverVersion}
            alt={title}
            className="ring-1 ring-foreground/5 transition group-hover:ring-foreground/20"
          />
          <span className="absolute bottom-1.5 left-1.5 rounded-md bg-background/90 px-1.5 py-0.5 text-[11px] font-medium tabular-nums shadow-sm">
            {allRead ? "✓ " : ""}
            {completed > 0 && !allRead ? `${completed}/` : ""}
            {count}
          </span>
        </div>
        <div className="mt-2 space-y-0.5 px-0.5">
          <p className="line-clamp-2 text-sm leading-snug font-medium">{title}</p>
          {subtitle && <p className="truncate text-xs text-muted-foreground">{subtitle}</p>}
        </div>
      </Link>
      {menu && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="secondary"
              size="icon-sm"
              className="absolute top-1.5 right-1.5 opacity-100 shadow-sm transition sm:opacity-0 sm:group-hover:opacity-100 sm:aria-expanded:opacity-100"
            >
              <MoreHorizontalIcon />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">{menu}</DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  )
}
