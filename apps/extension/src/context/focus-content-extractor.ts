import type { PageContext } from "@attention-ui/shared"
import { normalizeVisibleText, truncateText } from "./semantic-block"

export type FocusReaderBlock =
  | { type: "heading"; level: 1 | 2 | 3; text: string }
  | { type: "paragraph"; text: string }
  | { type: "quote"; text: string }
  | { type: "list-item"; text: string }
  | { type: "code"; text: string }

export type FocusReaderContent = {
  title: string
  blocks: FocusReaderBlock[]
}

export const MAX_FOCUS_READER_CHARACTERS = 16_000
export const MAX_MAIN_SOURCE_CHARACTERS = 30_000

const READER_BLOCK_SELECTOR = "h1, h2, h3, p, blockquote, li, pre"
const SENSITIVE_CONTROL_SELECTOR = "input, textarea, select, button, [contenteditable]"
const SENSITIVE_REGION_SELECTOR = "section, fieldset, dialog"
const EXCLUDED_READER_SELECTOR = [
  "nav",
  "footer",
  "header",
  "aside",
  "form",
  "button",
  "input",
  "textarea",
  "select",
  "option",
  "iframe",
  "video",
  "audio",
  "canvas",
  "script",
  "style",
  "[contenteditable]",
  "[role='navigation']",
  "[role='form']",
  "[aria-hidden='true']",
  "[class~='ad']",
  "[class*='advert']",
  "[id*='advert']",
  "#attention-ui-host"
].join(", ")

const isInsideSensitiveRegion = (element: Element, root: HTMLElement): boolean => {
  let ancestor = element.parentElement
  while (ancestor && ancestor !== root) {
    if (
      ancestor.matches(SENSITIVE_REGION_SELECTOR) &&
      ancestor.querySelector(SENSITIVE_CONTROL_SELECTOR)
    ) {
      return true
    }
    ancestor = ancestor.parentElement
  }
  return false
}

const isExcludedReaderElement = (element: Element, root: HTMLElement): boolean =>
  element.closest(EXCLUDED_READER_SELECTOR) !== null || isInsideSensitiveRegion(element, root)

const cloneWithoutExcludedContent = (element: Element | null): Element | null => {
  if (!element || element.closest(EXCLUDED_READER_SELECTOR)) {
    return null
  }

  const clone = element.cloneNode(true) as Element
  for (const excludedElement of clone.querySelectorAll(EXCLUDED_READER_SELECTOR)) {
    excludedElement.remove()
  }
  return clone
}

const getSafeText = (element: Element | null): string =>
  normalizeVisibleText(cloneWithoutExcludedContent(element)?.textContent ?? "")

const getBlockText = (element: Element): string => {
  const safeElement = cloneWithoutExcludedContent(element)
  if (!safeElement) {
    return ""
  }

  return element.matches("pre")
    ? (safeElement.textContent ?? "").replace(/\r\n?/gu, "\n").trim()
    : normalizeVisibleText(safeElement.textContent ?? "")
}

const getReaderElements = (root: HTMLElement): Element[] => [
  ...(root.matches(READER_BLOCK_SELECTOR) ? [root] : []),
  ...Array.from(root.querySelectorAll(READER_BLOCK_SELECTOR))
]

const exceedsSafeSourceLimit = (root: HTMLElement): boolean => {
  let characterCount = 0
  for (const element of getReaderElements(root)) {
    if (isExcludedReaderElement(element, root)) {
      continue
    }
    characterCount += Array.from(getBlockText(element)).length
    if (characterCount > MAX_MAIN_SOURCE_CHARACTERS) {
      return true
    }
  }
  return false
}

const selectContentRoot = (candidate: HTMLElement): HTMLElement => {
  const article = candidate.closest("article") as HTMLElement | null
  if (article) {
    return article
  }

  const main = candidate.closest("main") as HTMLElement | null
  if (main && !exceedsSafeSourceLimit(main)) {
    return main
  }

  return candidate
}

const getReaderTitle = (
  candidate: HTMLElement,
  context: PageContext,
  sourceDocument: Document
): string => {
  const articleTitle = getSafeText(candidate.closest("article")?.querySelector("h1") ?? null)
  const pageHeading = getSafeText(
    sourceDocument.querySelector("main h1") ?? sourceDocument.querySelector("h1")
  )

  return truncateText(
    articleTitle || pageHeading || context.nearbyHeading || normalizeVisibleText(sourceDocument.title) || "专注阅读",
    200
  )
}

const toReaderBlock = (element: Element, text: string): FocusReaderBlock => {
  switch (element.tagName.toLowerCase()) {
    case "h1":
      return { type: "heading", level: 1, text }
    case "h2":
      return { type: "heading", level: 2, text }
    case "h3":
      return { type: "heading", level: 3, text }
    case "blockquote":
      return { type: "quote", text }
    case "li":
      return { type: "list-item", text }
    case "pre":
      return { type: "code", text }
    default:
      return { type: "paragraph", text }
  }
}

export const extractFocusReaderContent = (
  candidate: HTMLElement,
  context: PageContext,
  sourceDocument: Document = document
): FocusReaderContent | null => {
  const root = selectContentRoot(candidate)
  const title = getReaderTitle(candidate, context, sourceDocument)
  const elements = getReaderElements(root)
  const blocks: FocusReaderBlock[] = []
  let remainingCharacters = MAX_FOCUS_READER_CHARACTERS

  for (const element of elements) {
    if (isExcludedReaderElement(element, root)) {
      continue
    }

    const text = getBlockText(element)
    if (!text || (element.matches("h1") && text === title)) {
      continue
    }

    const truncatedText = truncateText(text, remainingCharacters)
    if (!truncatedText) {
      break
    }
    blocks.push(toReaderBlock(element, truncatedText))
    remainingCharacters -= Array.from(truncatedText).length
    if (remainingCharacters === 0) {
      break
    }
  }

  return blocks.length > 0 ? { title, blocks } : null
}
