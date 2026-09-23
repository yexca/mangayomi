import { Component, type ErrorInfo, type ReactNode } from "react"

import i18n from "@/i18n"
import { Button } from "@/components/ui/button"

/** Shows a recoverable message instead of a blank page when rendering fails. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="font-medium">{i18n.t("common.error")}</p>
        <p className="max-w-md font-mono text-xs break-all text-muted-foreground">{this.state.error.message}</p>
        <Button onClick={() => window.location.reload()}>{i18n.t("common.retry")}</Button>
      </div>
    )
  }
}
