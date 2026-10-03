import type { ContextKind, NumericCandidate } from "@attention-ui/shared"
import type { SemanticBlockKind } from "./semantic-block"

const YEAR_PATTERN = /^\d{4}$/u
const DATE_ONLY_PATTERN = /^\s*\d{4}[-/.]\d{1,2}[-/.]\d{1,2}\s*[。.!！?？]?\s*$/u

const isYearCandidate = (candidate: NumericCandidate): boolean =>
  YEAR_PATTERN.test(candidate.rawValue) &&
  candidate.value !== null &&
  candidate.value >= 1000 &&
  candidate.value <= 2999

export type ContentClassificationInput = {
  element: HTMLElement
  semanticKind: SemanticBlockKind
  text: string
  numericCandidates: NumericCandidate[]
}

export const classifyContent = ({
  element,
  semanticKind,
  text,
  numericCandidates
}: ContentClassificationInput): ContextKind => {
  if (semanticKind === "code" || element.matches("pre, code") || element.querySelector("pre, code") !== null) {
    return "code"
  }

  if (semanticKind === "table" || element.matches("table, tr, td, th") || element.querySelector("table, tr, td, th") !== null) {
    return "table"
  }

  const meaningfulNumbers = numericCandidates.filter((candidate) => !isYearCandidate(candidate))
  if (!DATE_ONLY_PATTERN.test(text) && numericCandidates.length >= 2 && meaningfulNumbers.length >= 1) {
    return "numbers"
  }

  return text ? "text" : "unknown"
}
