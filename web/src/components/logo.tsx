import { cn } from "@/lib/utils"

export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={cn("size-7", className)}>
      <rect width="32" height="32" rx="8" className="fill-foreground" />
      <path
        d="M16 10.5c-2.2-1.6-5-2.2-8-2v13c3-.2 5.8.4 8 2 2.2-1.6 5-2.2 8-2v-13c-3-.2-5.8.4-8 2Z"
        className="fill-background"
      />
      <path d="M16 10.5v13" className="stroke-foreground" strokeWidth="1.5" />
    </svg>
  )
}
