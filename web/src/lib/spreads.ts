import type { PageDim } from "@/lib/api"

const isWide = (d: PageDim | undefined) => !!d && d.w > d.h * 1.05

/**
 * Groups page indices into what is shown at once. In double mode pages are
 * paired, except wide pages (already a two-page spread) which stand alone,
 * and optionally the first page, which is usually a cover.
 */
export function buildSpreads(dims: PageDim[], count: number, double: boolean, coverAlone: boolean): number[][] {
  const spreads: number[][] = []
  if (!double) {
    for (let i = 0; i < count; i++) spreads.push([i])
    return spreads
  }
  let i = 0
  if (coverAlone && count > 0) {
    spreads.push([0])
    i = 1
  }
  while (i < count) {
    if (isWide(dims[i]) || i + 1 >= count || isWide(dims[i + 1])) {
      spreads.push([i])
      i++
    } else {
      spreads.push([i, i + 1])
      i += 2
    }
  }
  return spreads
}
