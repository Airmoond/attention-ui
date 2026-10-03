export type SemanticBlockKind = "paragraph" | "list" | "table" | "code" | "section"

export type SemanticBlock = {
  element: HTMLElement
  text: string
  rect: DOMRect
  kind: SemanticBlockKind
}

export type BlockSize = Pick<DOMRect, "width" | "height" | "top" | "left" | "right" | "bottom">

export const SEMANTIC_BLOCK_LIMITS = {
  minimumTextLength: 20,
  minimumWidth: 40,
  minimumHeight: 16,
  maximumViewportCoverage: 0.8
} as const

const HOST_ID = "attention-ui-host"
const SENSITIVE_CONTENT_SELECTOR =
  "input, textarea, select, option, button, form, [hidden], [inert], [aria-hidden='true'], [contenteditable=''], [contenteditable='true'], [contenteditable='plaintext-only']"
const EXCLUDED_TAGS = new Set([
  "input",
  "textarea",
  "select",
  "option",
  "button",
  "form",
  "nav",
  "footer",
  "html",
  "body"
])

const SEMANTIC_TAGS = ["pre", "blockquote", "li", "p", "tr", "table", "article", "section", "div"] as const

const kindForElement = (element: HTMLElement): SemanticBlockKind => {
  switch (element.tagName.toLowerCase()) {
    case "pre":
      return "code"
    case "li":
      return "list"
    case "tr":
    case "table":
      return "table"
    case "article":
    case "section":
    case "div":
      return "section"
    default:
      return "paragraph"
  }
}

export const normalizeVisibleText = (text: string): string => text.replace(/\s+/gu, " ").trim()

export const truncateText = (text: string, maximumLength: number): string =>
  Array.from(text).slice(0, maximumLength).join("")

export const hasMeaningfulText = (text: string): boolean => {
  const normalized = normalizeVisibleText(text)
  const effectiveCharacters = Array.from(normalized).filter((character) => /[\p{L}\p{N}]/u.test(character))
  return (
    effectiveCharacters.length >= SEMANTIC_BLOCK_LIMITS.minimumTextLength &&
    !/^[\p{P}\p{S}\s]+$/u.test(normalized) &&
    !/^\d+$/u.test(normalized)
  )
}

export const hasAcceptableBlockSize = (
  rect: BlockSize,
  viewport: Pick<Window, "innerWidth" | "innerHeight"> = window
): boolean => {
  if (rect.width < SEMANTIC_BLOCK_LIMITS.minimumWidth || rect.height < SEMANTIC_BLOCK_LIMITS.minimumHeight) {
    return false
  }

  const viewportArea = viewport.innerWidth * viewport.innerHeight
  if (viewportArea <= 0) {
    return false
  }

  return rect.width * rect.height <= viewportArea * SEMANTIC_BLOCK_LIMITS.maximumViewportCoverage
}

const isHeaderNavigation = (element: HTMLElement): boolean => {
  const header = element.closest("header")
  return header !== null && (header.querySelector("nav") !== null || header.getAttribute("role") === "navigation")
}

export const isExcludedFromAttention = (element: Element | null): boolean => {
  if (!(element instanceof HTMLElement)) {
    return true
  }

  if (element.closest(`#${HOST_ID}`) !== null || element.getRootNode() instanceof ShadowRoot) {
    return true
  }

  if (EXCLUDED_TAGS.has(element.tagName.toLowerCase()) || element.isContentEditable) {
    return true
  }

  return (
    element.closest("input, textarea, select, option, button, form, nav, footer") !== null ||
    element.closest("[hidden], [inert], [aria-hidden='true']") !== null ||
    element.closest("[contenteditable=''], [contenteditable='true'], [contenteditable='plaintext-only']") !== null ||
    isHeaderNavigation(element)
  )
}

const getCandidateElements = (element: HTMLElement): HTMLElement[] => {
  const isTableCell = element.closest("td, th")
  const candidates: HTMLElement[] = []

  if (isTableCell) {
    const row = isTableCell.closest("tr")
    const table = isTableCell.closest("table")
    if (row instanceof HTMLElement) {
      candidates.push(row)
    }
    if (table instanceof HTMLElement) {
      candidates.push(table)
    }
  }

  for (const tagName of SEMANTIC_TAGS) {
    const candidate = element.closest(tagName)
    if (candidate instanceof HTMLElement && !candidates.includes(candidate)) {
      candidates.push(candidate)
    }
  }

  return candidates
}

const isCandidateValid = (element: HTMLElement): boolean =>
  !isExcludedFromAttention(element) &&
  element.querySelector(SENSITIVE_CONTENT_SELECTOR) === null &&
  hasMeaningfulText(element.innerText) &&
  hasAcceptableBlockSize(element.getBoundingClientRect())

export const resolveSemanticBlockAtPoint = (x: number, y: number): SemanticBlock | null => {
  const target = document.elementFromPoint(x, y)
  if (!(target instanceof HTMLElement) || isExcludedFromAttention(target)) {
    return null
  }

  for (const candidate of getCandidateElements(target)) {
    if (!isCandidateValid(candidate)) {
      continue
    }

    return {
      element: candidate,
      text: normalizeVisibleText(candidate.innerText),
      rect: candidate.getBoundingClientRect(),
      kind: kindForElement(candidate)
    }
  }

  return null
}

export class SemanticBlockDebugOutline {
  private current: { element: HTMLElement; outline: string; outlineOffset: string } | null = null

  public show(block: SemanticBlock | null): void {
    if (this.current?.element === block?.element) {
      return
    }

    this.clear()
    if (!block) {
      return
    }

    this.current = {
      element: block.element,
      outline: block.element.style.outline,
      outlineOffset: block.element.style.outlineOffset
    }
    block.element.style.outline = "1px solid rgba(39, 94, 254, 0.55)"
    block.element.style.outlineOffset = "2px"
  }

  public clear(): void {
    if (!this.current) {
      return
    }

    this.current.element.style.outline = this.current.outline
    this.current.element.style.outlineOffset = this.current.outlineOffset
    this.current = null
  }
}
