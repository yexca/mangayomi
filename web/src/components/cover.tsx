import { BookImage } from "lucide-react"
import { useState } from "react"

import { coverUrl } from "@/lib/api"
import { cn } from "@/lib/utils"

interface CoverProps {
  id: number
  version: number
  alt: string
  className?: string
}

/** Lazy-loaded cover thumbnail with a neutral placeholder. */
export function Cover({ id, version, alt, className }: CoverProps) {
  const [state, setState] = useState<"loading" | "loaded" | "error">("loading")
  return (
    <div className={cn("relative aspect-[2/3] overflow-hidden rounded-lg bg-muted", className)}>
      {state !== "error" && (
        <img
          src={coverUrl(id, version)}
          alt={alt}
          loading="lazy"
          decoding="async"
          draggable={false}
          onLoad={() => setState("loaded")}
          onError={() => setState("error")}
          className={cn(
            "size-full object-cover transition-opacity duration-300",
            state === "loaded" ? "opacity-100" : "opacity-0",
          )}
        />
      )}
      {state !== "loaded" && (
        <div className="absolute inset-0 flex items-center justify-center text-muted-foreground/40">
          <BookImage className={cn("size-8", state === "loading" && "animate-pulse")} />
        </div>
      )}
    </div>
  )
}
