import type { TFunction } from "i18next"

import i18n from "@/i18n"
import { ApiError } from "@/lib/api"

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const units = ["KB", "MB", "GB", "TB"]
  let v = bytes / 1024
  let i = 0
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i++
  }
  return `${v.toFixed(v < 10 ? 1 : 0)} ${units[i]}`
}

export function formatDate(ms: number): string {
  return new Intl.DateTimeFormat(i18n.language, { dateStyle: "medium" }).format(ms)
}

export function formatRelative(ms: number): string {
  const rtf = new Intl.RelativeTimeFormat(i18n.language, { numeric: "auto" })
  const diff = (ms - Date.now()) / 1000
  const steps: [Intl.RelativeTimeFormatUnit, number][] = [
    ["second", 60],
    ["minute", 60],
    ["hour", 24],
    ["day", 30],
    ["month", 12],
    ["year", Infinity],
  ]
  let v = diff
  for (const [unit, size] of steps) {
    if (Math.abs(v) < size) return rtf.format(Math.round(v), unit)
    v /= size
  }
  return rtf.format(Math.round(v), "year")
}

/** A translated message for an API error, falling back to the server text. */
export function errorMessage(err: unknown, t: TFunction): string {
  if (err instanceof ApiError) {
    const key = `errors.${err.code}`
    if (i18n.exists(key)) return t(key as never)
    return err.message
  }
  if (err instanceof Error) return err.message
  return t("common.error")
}
