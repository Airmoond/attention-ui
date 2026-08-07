import type { NumericCandidate } from "@focus-ui/shared"
import { normalizeVisibleText, truncateText } from "./semantic-block"

const NUMERIC_PATTERN = /(?:[¥￥$€£]\s*)?[-+]?\d+(?:,\d{3})*(?:\.\d+)?%?/gu
const MAX_NUMERIC_CANDIDATES = 20

const parseNumericValue = (rawValue: string): number | null => {
  const normalized = rawValue.replace(/[¥￥$€£,%\s]/gu, "")
  if (!normalized) {
    return null
  }

  const value = Number(normalized)
  return Number.isFinite(value) ? value : null
}

const getCandidateLabel = (text: string, index: number, rawValue: string): string => {
  const before = text.slice(Math.max(0, index - 36), index)
  const after = text.slice(index + rawValue.length, index + rawValue.length + 36)
  const nearby = `${before} ${after}`.replace(NUMERIC_PATTERN, " ")
  return truncateText(normalizeVisibleText(nearby), 80)
}

export const extractNumericCandidates = (text: string): NumericCandidate[] => {
  const candidates: NumericCandidate[] = []
  const seenRawValues = new Set<string>()

  for (const match of text.matchAll(NUMERIC_PATTERN)) {
    const rawValue = match[0]
    if (!rawValue || seenRawValues.has(rawValue)) {
      continue
    }

    seenRawValues.add(rawValue)
    candidates.push({
      label: getCandidateLabel(text, match.index ?? 0, rawValue),
      rawValue,
      value: parseNumericValue(rawValue)
    })
    if (candidates.length === MAX_NUMERIC_CANDIDATES) {
      break
    }
  }

  return candidates
}

export { MAX_NUMERIC_CANDIDATES, parseNumericValue }
