import { QueryClient, QueryClientProvider, useQuery, useQueryClient } from "@tanstack/react-query"
import { Loader2Icon } from "lucide-react"
import { ThemeProvider } from "next-themes"
import { useEffect } from "react"
import { BrowserRouter, Navigate, Route, Routes } from "react-router"

import { AppShell } from "@/components/app-shell"
import { ErrorBoundary } from "@/components/error-boundary"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { LibraryFilterProvider } from "@/hooks/use-library-filter"
import { api, ApiError, onUnauthorized } from "@/lib/api"
import { AuthorDetailPage, AuthorsListPage } from "@/pages/authors"
import { BrowsePage } from "@/pages/browse"
import { HomePage } from "@/pages/home"
import { LibraryFormPage } from "@/pages/library-form"
import { LoginPage } from "@/pages/login"
import { ReaderPage } from "@/pages/reader"
import { SeriesDetailPage, SeriesListPage } from "@/pages/series"
import { SettingsPage } from "@/pages/settings"
import { WorkPage } from "@/pages/work"

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: (count, err) => !(err instanceof ApiError && err.status > 0 && err.status < 500) && count < 2,
    },
  },
})

function AuthGate() {
  const qc = useQueryClient()
  const auth = useQuery({ queryKey: ["auth"], queryFn: api.authStatus, staleTime: Infinity })

  useEffect(() => {
    onUnauthorized(() => qc.invalidateQueries({ queryKey: ["auth"] }))
  }, [qc])

  if (auth.isLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Loader2Icon className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }
  if (auth.data?.setupRequired) return <LoginPage setup />
  if (!auth.data?.authenticated) return <LoginPage setup={false} />

  return (
    <Routes>
      <Route path="/read/:id" element={<ReaderPage />} />
      <Route element={<AppShell />}>
        <Route index element={<HomePage />} />
        <Route path="library" element={<BrowsePage />} />
        <Route path="series" element={<SeriesListPage />} />
        <Route path="series/view" element={<SeriesDetailPage />} />
        <Route path="authors" element={<AuthorsListPage />} />
        <Route path="authors/view" element={<AuthorDetailPage />} />
        <Route path="works/:id" element={<WorkPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="settings/libraries/new" element={<LibraryFormPage />} />
        <Route path="settings/libraries/:id" element={<LibraryFormPage key="edit" />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

export default function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange storageKey="mangayomi.theme">
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <LibraryFilterProvider>
            <BrowserRouter>
              <ErrorBoundary>
                <AuthGate />
              </ErrorBoundary>
            </BrowserRouter>
          </LibraryFilterProvider>
          <Toaster position="top-center" />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  )
}
