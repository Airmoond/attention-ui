import { PageContextSchema, type PageContext } from "@focus-ui/shared"
import { readDocumentSelection } from "../attention/selection-tracker"
import { classifyContent } from "./content-classifier"
import { extractNumericCandidates } from "./number-extractor"
import { normalizeVisibleText, truncateText, type SemanticBlockKind } from "./semantic-block"

const MAX_CONTEXT_TEXT_LENGTH = 1500
const MAX_PAGE_TITLE_LENGTH = 200
const MAX_HEADING_LENGTH = 200
const HEADING_SELECTOR = "h1, h2, h3, h4, h5, h6"

export type ContextSource = {
  element: HTMLElement
  text: string
  kind: SemanticBlockKind
}

const getHeadingText = (element: Element | null): string | null => {
  if (!(element instanceof HTMLElement)) {
    return null
  }

  const text = truncateText(normalizeVisibleText(element.innerText), MAX_HEADING_LENGTH)
  return text || null
}

const getPreviousHeadingInScope = (element: HTMLElement, scope: Element): string | null => {
  const headings = Array.from(scope.querySelectorAll(HEADING_SELECTOR)).slice(-80)
  let nearest: Element | null = null
  for (const heading of headings) {
    if (heading.compareDocumentPosition(element) & Node.DOCUMENT_POSITION_FOLLOWING) {
      nearest = heading
    }
  }
  return getHeadingText(nearest)
}

const getPreviousSiblingHeading = (element: HTMLElement): string | null => {
  let current: Element | null = element
  for (let steps = 0; current && steps < 80; steps += 1) {
    if (current.previousElementSibling) {
      current = current.previousElementSibling
      if (current.matches(HEADING_SELECTOR)) {
        return getHeadingText(current)
      }
      const nestedHeadings = current.querySelectorAll(HEADING_SELECTOR)
      const nestedHeading = nestedHeadings.item(nestedHeadings.length - 1)
      if (nestedHeading) {
        return getHeadingText(nestedHeading)
      }
      continue
    }
    current = current.parentElement
    if (current === document.body || current === document.documentElement) {
      return null
    }
  }
  return null
}

export const findNearbyHeading = (element: HTMLElement): string | null => {
  const internalHeading = element.querySelector(HEADING_SELECTOR)
  if (internalHeading) {
    return getHeadingText(internalHeading)
  }

  const section = element.closest("article, section")
  if (section) {
    const sectionHeading = getPreviousHeadingInScope(element, section)
    if (sectionHeading) {
      return sectionHeading
    }
  }

  return getPreviousSiblingHeading(element)
}

const getSelectedTextForBlock = (element: HTMLElement): string | null => {
  const selection = document.getSelection()
  if (!selection || selection.rangeCount === 0) {
    return null
  }

  try {
    return selection.getRangeAt(0).intersectsNode(element) ? readDocumentSelection() : null
  } catch (_error: unknown) {
    return null
  }
}

export const extractPageContext = (source: ContextSource): PageContext => {
  const text = truncateText(normalizeVisibleText(source.text), MAX_CONTEXT_TEXT_LENGTH)
  const numericCandidates = extractNumericCandidates(text)
  return PageContextSchema.parse({
    url: truncateText(window.location.href, 2048),
    pageTitle: truncateText(normalizeVisibleText(document.title), MAX_PAGE_TITLE_LENGTH),
    text,
    selectedText: getSelectedTextForBlock(source.element),
    nearbyHeading: findNearbyHeading(source.element),
    contextKind: classifyContent({
      element: source.element,
      semanticKind: source.kind,
      text,
      numericCandidates
    }),
    numericCandidates
  })
}
