import { useQuery, useQueryClient } from "@tanstack/react-query"
import {
  ArrowLeftIcon,
  ChevronsLeftIcon,
  ChevronsRightIcon,
  CircleCheckIcon,
  ImageOffIcon,
  Loader2Icon,
  MaximizeIcon,
  MinimizeIcon,
  RotateCcwIcon,
  Settings2Icon,
} from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent, type ReactNode, type TouchEvent } from "react"
import { useTranslation } from "react-i18next"
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { directionKey, useReaderPrefs, type PageFit, type PageLayout } from "@/hooks/use-reader-prefs"
import { useMediaQuery } from "@/hooks/use-media-query"
import { api, pageUrl, type PageDim, type ReadingDirection, type WorkDetail } from "@/lib/api"
import { errorMessage } from "@/lib/format"
import { buildSpreads } from "@/lib/spreads"
import { cn } from "@/lib/utils"

export function ReaderPage() {
  const { t } = useTranslation()
  const id = Number(useParams().id)
  const [params] = useSearchParams()
  // Always fetch fresh: the starting page comes from the saved progress.
  const work = useQuery({ queryKey: ["work", id, "reader"], queryFn: () => api.work(id), gcTime: 0 })
  const pages = useQuery({ queryKey: ["pages", id], queryFn: () => api.pages(id), staleTime: Infinity })
  const navigate = useNavigate()

  const error = work.error ?? pages.error
  if (error) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center gap-4 bg-black p-6 text-center text-white">
        <p className="text-sm text-white/70">{errorMessage(error, t)}</p>
        <Button variant="secondary" onClick={() => navigate("/")}>
          {t("common.back")}
        </Button>
      </div>
    )
  }
  if (!work.data || !pages.data) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-black">
        <Loader2Icon className="size-6 animate-spin text-white/50" />
      </div>
    )
  }

  const w = work.data
  const last = Math.max(w.pageCount - 1, 0)
  const param = params.get("page")
  const initial =
    param !== null
      ? Math.min(Math.max(Number(param) || 0, 0), last)
      : w.progress && !w.progress.completed
        ? Math.min(w.progress.page, last)
        : 0
  return <Reader key={id} work={w} dims={pages.data.pages} initialPage={initial} />
}

function Reader({ work, dims, initialPage }: { work: WorkDetail; dims: PageDim[]; initialPage: number }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const qc = useQueryClient()
  const [prefs, setPrefs] = useReaderPrefs()

  const dirKey = directionKey(work)
  const direction: ReadingDirection = prefs.directions[dirKey] ?? work.readingDirection
  const rtl = direction === "rtl"
  const wideScreen = useMediaQuery("(min-width: 768px) and (orientation: landscape)")
  const double = prefs.layout === "double" || (prefs.layout === "auto" && wideScreen)
  const fit = prefs.fit
  const count = work.pageCount

  const spreads = useMemo(() => buildSpreads(dims, count, double, prefs.coverAlone), [dims, count, double, prefs.coverAlone])
  const [page, setPage] = useState(initialPage)
  const [ended, setEnded] = useState(false)
  const [ui, setUi] = useState(true)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [loaded, setLoaded] = useState<Record<string, "ok" | "error">>({})

  const si = Math.max(0, spreads.findIndex((s) => s.includes(page)))
  const spread = spreads[si] ?? [page]
  const lastShown = spread[spread.length - 1]
  const completed = ended || lastShown >= count - 1

  const next = useCallback(() => {
    if (si < spreads.length - 1) {
      setPage(spreads[si + 1][0])
      setUi(false)
    } else {
      setEnded(true)
    }
  }, [si, spreads])

  const prev = useCallback(() => {
    if (ended) {
      setEnded(false)
      return
    }
    if (si > 0) {
      setPage(spreads[si - 1][0])
      setUi(false)
    }
  }, [ended, si, spreads])

  // In right-to-left reading the next page is on the left.
  const left = rtl ? next : prev
  const right = rtl ? prev : next

  // ---- progress ----
  const latest = useRef({ page, completed })
  const saved = useRef(work.progress?.completed ? `${initialPage}:false` : "")

  const save = useCallback(() => {
    const { page, completed } = latest.current
    const key = `${page}:${completed}`
    if (key === saved.current) return Promise.resolve()
    saved.current = key
    return api.setProgress(work.id, completed ? count - 1 : page, completed).catch(() => {
      saved.current = ""
    })
  }, [work.id, count])

  useEffect(() => {
    latest.current = { page, completed }
    const timer = setTimeout(save, 600)
    return () => clearTimeout(timer)
  }, [page, completed, save])

  useEffect(() => {
    const onHide = () => document.visibilityState === "hidden" && save()
    document.addEventListener("visibilitychange", onHide)
    return () => {
      document.removeEventListener("visibilitychange", onHide)
      save().finally(() => qc.invalidateQueries({ predicate: (q) => q.queryKey[0] !== "pages" }))
    }
  }, [save, qc])

  // ---- navigation ----
  const exit = useCallback(() => {
    if (location.key !== "default") navigate(-1)
    else navigate(`/works/${work.id}`, { replace: true })
  }, [location.key, navigate, work.id])

  const openWork = (id: number) => navigate(`/read/${id}`, { replace: true })

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (settingsOpen || e.altKey || e.ctrlKey || e.metaKey) return
      const handlers: Record<string, () => void> = {
        ArrowLeft: left,
        ArrowRight: right,
        PageDown: next,
        PageUp: prev,
        " ": next,
        Escape: exit,
      }
      const h = handlers[e.key]
      if (h) {
        e.preventDefault()
        h()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [left, right, next, prev, exit, settingsOpen])

  // Width fit scrolls; start each spread at the top.
  const stage = useRef<HTMLDivElement>(null)
  useEffect(() => {
    stage.current?.scrollTo({ top: 0 })
  }, [si, ended])

  // Preload the neighbouring spreads.
  useEffect(() => {
    const around = [si + 1, si + 2, si - 1].flatMap((i) => spreads[i] ?? [])
    for (const n of around) new Image().src = pageUrl(work.id, n, work.mtime)
  }, [si, spreads, work.id, work.mtime])

  const onStageClick = (e: MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width
    if (x < 0.3) left()
    else if (x > 0.7) right()
    else setUi((v) => !v)
  }

  const touch = useRef<{ x: number; y: number } | null>(null)
  const onTouchStart = (e: TouchEvent) => {
    touch.current = e.touches.length === 1 ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : null
  }
  const onTouchEnd = (e: TouchEvent) => {
    const start = touch.current
    touch.current = null
    if (!start || e.changedTouches.length !== 1) return
    if ((window.visualViewport?.scale ?? 1) > 1.01) return // pinch-zoomed: let the user pan
    const dx = e.changedTouches[0].clientX - start.x
    const dy = e.changedTouches[0].clientY - start.y
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      // Swiping right pulls in what is on the left.
      if (dx > 0) left()
      else right()
    }
  }

  const loading = !ended && spread.some((n) => !loaded[pageUrl(work.id, n, work.mtime)])
  const failed = !ended && spread.some((n) => loaded[pageUrl(work.id, n, work.mtime)] === "error")
  const indicator = spread.length > 1 ? `${spread[0] + 1}–${spread[1] + 1}` : `${spread[0] + 1}`
  const subtitle = [work.author, work.series].filter(Boolean).join(" · ")

  // Previous/next work buttons follow the reading direction too.
  const leftWork = rtl ? work.next : work.prev
  const rightWork = rtl ? work.prev : work.next

  return (
    <div className="fixed inset-0 overflow-hidden overscroll-none bg-black text-white select-none">
      <div
        ref={stage}
        className={cn("absolute inset-0 overscroll-none", fit === "width" && !ended ? "overflow-y-auto" : "overflow-hidden")}
        onClick={onStageClick}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {ended ? (
          <EndScreen
            work={work}
            onNext={work.next ? () => openWork(work.next!.id) : undefined}
            onDetails={() => navigate(`/works/${work.id}`, { replace: true })}
            onRestart={() => {
              setEnded(false)
              setPage(0)
            }}
          />
        ) : (
          <div
            className={cn(
              "flex w-full justify-center",
              fit === "contain" ? "h-full items-center" : "min-h-full items-start",
              rtl ? "flex-row-reverse" : "flex-row",
            )}
          >
            {spread.map((n) => {
              const src = pageUrl(work.id, n, work.mtime)
              return (
                <img
                  key={src}
                  src={src}
                  alt=""
                  draggable={false}
                  decoding="async"
                  onLoad={() => setLoaded((m) => ({ ...m, [src]: "ok" }))}
                  onError={() => setLoaded((m) => ({ ...m, [src]: "error" }))}
                  className={cn(
                    fit === "contain"
                      ? cn("max-h-full object-contain", spread.length > 1 ? "max-w-1/2" : "max-w-full")
                      : cn("h-auto", spread.length > 1 ? "w-1/2" : "w-full"),
                  )}
                />
              )
            })}
          </div>
        )}
        {loading && !failed && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <Loader2Icon className="size-6 animate-spin text-white/50" />
          </div>
        )}
        {failed && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 text-white/60">
            <ImageOffIcon className="size-8" />
            <p className="text-sm">{t("reader.pageLoadFailed")}</p>
          </div>
        )}
      </div>

      {/* Top bar */}
      <div
        className={cn(
          "absolute inset-x-0 top-0 z-10 bg-gradient-to-b from-black/85 via-black/50 to-transparent pt-[env(safe-area-inset-top)] transition duration-200",
          ui ? "opacity-100" : "pointer-events-none -translate-y-2 opacity-0",
        )}
      >
        <div className="flex items-center gap-1 px-2 py-2 sm:px-4">
          <BarButton onClick={exit} label={t("common.back")}>
            <ArrowLeftIcon />
          </BarButton>
          <div className="min-w-0 flex-1 px-1">
            <p className="truncate text-sm font-medium">{work.title}</p>
            {subtitle && <p className="truncate text-xs text-white/60">{subtitle}</p>}
          </div>
          <FullscreenButton label={t("reader.fullscreen")} />
          <BarButton onClick={() => setSettingsOpen(true)} label={t("reader.settings")}>
            <Settings2Icon />
          </BarButton>
        </div>
      </div>

      {/* Bottom bar */}
      <div
        className={cn(
          "absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/85 via-black/50 to-transparent pb-[env(safe-area-inset-bottom)] transition duration-200",
          ui ? "opacity-100" : "pointer-events-none translate-y-2 opacity-0",
        )}
      >
        <div className="mx-auto max-w-3xl px-3 pt-6 pb-3 sm:px-4">
          <p className="mb-2 text-center text-xs text-white/70 tabular-nums">
            {indicator} / {count}
          </p>
          <div className="flex items-center gap-2">
            <BarButton
              onClick={() => leftWork && openWork(leftWork.id)}
              disabled={!leftWork}
              label={leftWork?.title ?? (rtl ? t("reader.nextWorkShort") : t("reader.previousWork"))}
            >
              <ChevronsLeftIcon />
            </BarButton>
            <Slider
              className="flex-1 py-3 [&_[data-slot=slider-range]]:bg-white [&_[data-slot=slider-track]]:bg-white/25"
              min={0}
              max={Math.max(count - 1, 1)}
              step={1}
              disabled={count <= 1}
              inverted={rtl}
              value={[page]}
              onValueChange={([v]) => {
                setEnded(false)
                setPage(v)
              }}
            />
            <BarButton
              onClick={() => rightWork && openWork(rightWork.id)}
              disabled={!rightWork}
              label={rightWork?.title ?? (rtl ? t("reader.previousWork") : t("reader.nextWorkShort"))}
            >
              <ChevronsRightIcon />
            </BarButton>
          </div>
        </div>
      </div>

      <ReaderSettings
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        direction={direction}
        onDirection={(d) => setPrefs({ directions: { ...prefs.directions, [dirKey]: d } })}
        layout={prefs.layout}
        onLayout={(layout) => setPrefs({ layout })}
        fit={fit}
        onFit={(fit) => setPrefs({ fit })}
        coverAlone={prefs.coverAlone}
        onCoverAlone={(coverAlone) => setPrefs({ coverAlone })}
      />
    </div>
  )
}

function BarButton({
  children,
  label,
  onClick,
  disabled,
}: {
  children: ReactNode
  label: string
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <Button
      variant="ghost"
      size="icon-lg"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="text-white hover:bg-white/10 hover:text-white disabled:opacity-30 dark:hover:bg-white/10"
    >
      {children}
    </Button>
  )
}

function FullscreenButton({ label }: { label: string }) {
  const [full, setFull] = useState(() => !!document.fullscreenElement)
  useEffect(() => {
    const on = () => setFull(!!document.fullscreenElement)
    document.addEventListener("fullscreenchange", on)
    return () => document.removeEventListener("fullscreenchange", on)
  }, [])
  if (!document.fullscreenEnabled) return null
  return (
    <BarButton
      label={label}
      onClick={() => (full ? document.exitFullscreen() : document.documentElement.requestFullscreen()).catch(() => {})}
    >
      {full ? <MinimizeIcon /> : <MaximizeIcon />}
    </BarButton>
  )
}

function EndScreen({
  work,
  onNext,
  onDetails,
  onRestart,
}: {
  work: WorkDetail
  onNext?: () => void
  onDetails: () => void
  onRestart: () => void
}) {
  const { t } = useTranslation()
  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 p-6 text-center">
      <CircleCheckIcon className="size-12 text-white/80" strokeWidth={1.5} />
      <div className="space-y-1">
        <p className="text-lg font-semibold">{t("reader.finished")}</p>
        <p className="max-w-sm text-sm text-white/60">{t("reader.finishedDescription", { title: work.title })}</p>
      </div>
      <div className="flex w-full max-w-xs flex-col gap-2" onClick={(e) => e.stopPropagation()}>
        {onNext && work.next && (
          <Button size="lg" variant="secondary" className="h-10" onClick={onNext}>
            <span className="truncate">{t("reader.nextWork", { title: work.next.title })}</span>
          </Button>
        )}
        <Button
          size="lg"
          variant="ghost"
          className="h-10 text-white hover:bg-white/10 hover:text-white dark:hover:bg-white/10"
          onClick={onDetails}
        >
          {t("reader.backToDetails")}
        </Button>
        <Button
          size="lg"
          variant="ghost"
          className="h-10 text-white/70 hover:bg-white/10 hover:text-white dark:hover:bg-white/10"
          onClick={onRestart}
        >
          <RotateCcwIcon />
          {t("reader.startOver")}
        </Button>
      </div>
    </div>
  )
}

function ReaderSettings(props: {
  open: boolean
  onOpenChange: (open: boolean) => void
  direction: ReadingDirection
  onDirection: (d: ReadingDirection) => void
  layout: PageLayout
  onLayout: (l: PageLayout) => void
  fit: PageFit
  onFit: (f: PageFit) => void
  coverAlone: boolean
  onCoverAlone: (v: boolean) => void
}) {
  const { t } = useTranslation()
  return (
    <Sheet open={props.open} onOpenChange={props.onOpenChange}>
      <SheetContent side="bottom" className="mx-auto max-w-lg rounded-t-xl pb-[env(safe-area-inset-bottom)]">
        <SheetHeader>
          <SheetTitle>{t("reader.settings")}</SheetTitle>
          <SheetDescription>{t("reader.tapHint")}</SheetDescription>
        </SheetHeader>
        <div className="space-y-5 px-4 pb-6">
          <ReaderSettingsFields {...props} showDirection />
        </div>
      </SheetContent>
    </Sheet>
  )
}

/** Reader options, shared by the in-reader sheet and the settings page. */
// oxlint-disable-next-line react/only-export-components
export function ReaderSettingsFields(props: {
  direction?: ReadingDirection
  onDirection?: (d: ReadingDirection) => void
  showDirection?: boolean
  layout: PageLayout
  onLayout: (l: PageLayout) => void
  fit: PageFit
  onFit: (f: PageFit) => void
  coverAlone: boolean
  onCoverAlone: (v: boolean) => void
}) {
  const { t } = useTranslation()
  return (
    <>
      {props.showDirection && props.direction && (
        <Field label={t("reader.direction")} hint={t("reader.directionHint")}>
          <ToggleGroup
            type="single"
            variant="outline"
            spacing={0}
            value={props.direction}
            onValueChange={(v) => v && props.onDirection?.(v as ReadingDirection)}
          >
            <ToggleGroupItem value="rtl">{t("reader.rtl")}</ToggleGroupItem>
            <ToggleGroupItem value="ltr">{t("reader.ltr")}</ToggleGroupItem>
          </ToggleGroup>
        </Field>
      )}
      <Field label={t("reader.layout")} hint={t("reader.layoutHint")}>
        <ToggleGroup
          type="single"
          variant="outline"
          spacing={0}
          value={props.layout}
          onValueChange={(v) => v && props.onLayout(v as PageLayout)}
        >
          <ToggleGroupItem value="auto">{t("reader.layoutAuto")}</ToggleGroupItem>
          <ToggleGroupItem value="single">{t("reader.layoutSingle")}</ToggleGroupItem>
          <ToggleGroupItem value="double">{t("reader.layoutDouble")}</ToggleGroupItem>
        </ToggleGroup>
      </Field>
      <Field label={t("reader.fit")}>
        <ToggleGroup
          type="single"
          variant="outline"
          spacing={0}
          value={props.fit}
          onValueChange={(v) => v && props.onFit(v as PageFit)}
        >
          <ToggleGroupItem value="contain">{t("reader.fitContain")}</ToggleGroupItem>
          <ToggleGroupItem value="width">{t("reader.fitWidth")}</ToggleGroupItem>
        </ToggleGroup>
      </Field>
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <Label htmlFor="cover-alone">{t("reader.coverAlone")}</Label>
          <p className="text-xs text-muted-foreground">{t("reader.coverAloneHint")}</p>
        </div>
        <Switch id="cover-alone" checked={props.coverAlone} onCheckedChange={props.onCoverAlone} />
      </div>
    </>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}
