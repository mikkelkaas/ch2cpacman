/**
 * Fixes worse than this are shown but not trusted: no pellet is eaten and no
 * ghost catches on them. Woodland GPS jumps by tens of metres; a bad fix
 * landing on a pellet or inside a ghost would be pure luck either way.
 */
export const MAX_FIX_ACCURACY_M = 30;

export function isUsableFix(fix: { accuracyM: number } | null | undefined): boolean {
  return !!fix && Number.isFinite(fix.accuracyM) && fix.accuracyM <= MAX_FIX_ACCURACY_M;
}
