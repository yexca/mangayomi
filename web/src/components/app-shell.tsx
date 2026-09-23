import { BookOpenIcon, HomeIcon, LibraryIcon, Loader2Icon, SettingsIcon, UsersIcon } from "lucide-react"
import { useTranslation } from "react-i18next"
import { NavLink, Outlet } from "react-router"

import { Logo } from "@/components/logo"
import { useScanStatus } from "@/hooks/use-scan-status"
import { cn } from "@/lib/utils"

const items = [
  { to: "/", key: "nav.home", icon: HomeIcon, end: true },
  { to: "/library", key: "nav.library", icon: LibraryIcon },
  { to: "/series", key: "nav.series", icon: BookOpenIcon },
  { to: "/authors", key: "nav.authors", icon: UsersIcon },
  { to: "/settings", key: "nav.settings", icon: SettingsIcon },
] as const

export function AppShell() {
  const { t } = useTranslation()
  const scan = useScanStatus()
  const scanning = scan.data?.scans.filter((s) => s.running) ?? []

  return (
    <div className="min-h-dvh">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-56 flex-col border-r bg-sidebar px-3 py-4 md:flex">
        <div className="mb-6 flex items-center gap-2.5 px-2">
          <Logo />
          <span className="text-base font-semibold tracking-tight">{t("app.name")}</span>
        </div>
        <nav className="flex flex-1 flex-col gap-0.5">
          {items.map(({ to, key, icon: Icon, ...rest }) => (
            <NavLink
              key={to}
              to={to}
              end={"end" in rest}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground",
                  isActive && "bg-sidebar-accent text-sidebar-foreground",
                  to === "/settings" && "mt-auto",
                )
              }
            >
              <Icon className="size-4" />
              {t(key)}
            </NavLink>
          ))}
        </nav>
        {scanning.length > 0 && (
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-sidebar-accent px-2.5 py-2 text-xs text-muted-foreground">
            <Loader2Icon className="size-3.5 animate-spin" />
            {t("settings.scanning", { count: scanning.reduce((n, s) => n + s.scanned, 0) })}
          </div>
        )}
      </aside>

      <main className="px-4 pt-[calc(1.25rem+env(safe-area-inset-top))] pb-[calc(6rem+env(safe-area-inset-bottom))] sm:px-6 md:ml-56 md:px-8 md:pt-8 md:pb-12">
        <div className="mx-auto max-w-7xl">
          <Outlet />
        </div>
      </main>

      {/* Mobile bottom navigation */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/90 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        <div className="grid h-16 grid-cols-5">
          {items.map(({ to, key, icon: Icon, ...rest }) => (
            <NavLink
              key={to}
              to={to}
              end={"end" in rest}
              className={({ isActive }) =>
                cn(
                  "flex flex-col items-center justify-center gap-1 text-[11px] font-medium text-muted-foreground transition-colors",
                  isActive && "text-foreground",
                )
              }
            >
              <Icon className="size-5" />
              {t(key)}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
