import { useQuery } from "@tanstack/react-query"
import { ChevronRightIcon, CornerLeftUpIcon, FolderIcon, Loader2Icon } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { api } from "@/lib/api"
import { errorMessage } from "@/lib/format"

interface FolderPickerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  /** Browsing cannot go above this folder. Defaults to the data directory. */
  base?: string
  initialPath?: string
  /** Receives the absolute path and the path relative to base. */
  onSelect: (path: string, rel: string) => void
  /** Disallow picking the base folder itself. */
  requireSubfolder?: boolean
}

export function FolderPicker(props: FolderPickerProps) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {/* Mounted only while open, so every opening starts at initialPath. */}
        <FolderBrowser {...props} />
      </DialogContent>
    </Dialog>
  )
}

function FolderBrowser({ onOpenChange, title, base, initialPath, onSelect, requireSubfolder }: FolderPickerProps) {
  const { t } = useTranslation()
  const [path, setPath] = useState<string | undefined>(initialPath)

  const query = useQuery({
    queryKey: ["browse", base ?? "", path ?? ""],
    queryFn: () => api.browse(path, base),
  })
  const data = query.data
  const crumbs = data ? data.rel.split("/").filter(Boolean) : []

  return (
    <>
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription className="font-mono text-xs break-all">{data?.path ?? "…"}</DialogDescription>
      </DialogHeader>

      <div className="flex flex-wrap items-center gap-1 text-sm">
        <button
          type="button"
          className="rounded px-1.5 py-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          onClick={() => setPath(data?.base)}
        >
          {data ? data.base.split(/[\\/]/).filter(Boolean).pop() || "/" : "…"}
        </button>
        {crumbs.map((c, i) => (
          <span key={i} className="flex items-center gap-1">
            <ChevronRightIcon className="size-3 text-muted-foreground" />
            <button
              type="button"
              className="rounded px-1.5 py-0.5 hover:bg-muted"
              onClick={() => {
                if (!data) return
                // Walk up from the current path to this crumb.
                let p = data.path
                for (let k = crumbs.length - 1; k > i; k--) p = p.replace(/[\\/][^\\/]+$/, "")
                setPath(p)
              }}
            >
              {c}
            </button>
          </span>
        ))}
      </div>

      <ScrollArea className="h-72 rounded-lg border">
        <div className="p-1">
          {data?.parent && (
            <button
              type="button"
              onClick={() => setPath(data.parent ?? undefined)}
              className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm text-muted-foreground hover:bg-muted"
            >
              <CornerLeftUpIcon className="size-4" />
              {t("folderPicker.up")}
            </button>
          )}
          {query.isLoading && (
            <div className="flex justify-center py-10 text-muted-foreground">
              <Loader2Icon className="size-5 animate-spin" />
            </div>
          )}
          {query.error && <p className="p-3 text-sm text-destructive">{errorMessage(query.error, t)}</p>}
          {data?.dirs.length === 0 && (
            <p className="p-3 text-sm text-muted-foreground">{t("folderPicker.empty")}</p>
          )}
          {data?.dirs.map((d) => (
            <button
              key={d.path}
              type="button"
              onClick={() => setPath(d.path)}
              className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-muted"
            >
              <FolderIcon className="size-4 shrink-0 text-muted-foreground" />
              <span className="truncate">{d.name}</span>
              <ChevronRightIcon className="ml-auto size-4 shrink-0 text-muted-foreground" />
            </button>
          ))}
        </div>
      </ScrollArea>

      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          {t("common.cancel")}
        </Button>
        <Button
          disabled={!data || (requireSubfolder && !data.rel)}
          onClick={() => {
            if (!data) return
            onSelect(data.path, data.rel)
            onOpenChange(false)
          }}
        >
          {t("folderPicker.select")}
        </Button>
      </DialogFooter>
    </>
  )
}
