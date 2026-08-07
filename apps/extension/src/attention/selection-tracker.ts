import { normalizeVisibleText, truncateText } from "../context/semantic-block"

export type SelectionState = {
  text: string | null
  changedAt: number
}

export const MAX_SELECTION_LENGTH = 1500

const getElementForNode = (node: Node | null): Element | null =>
  node instanceof Element ? node : node?.parentElement ?? null

const isSensitiveEditableElement = (element: Element | null): boolean =>
  element?.closest(
    "input, textarea, select, option, [contenteditable=''], [contenteditable='true'], [contenteditable='plaintext-only']"
  ) !== null

export const readDocumentSelection = (maximumLength = MAX_SELECTION_LENGTH): string | null => {
  const selection = document.getSelection()
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
    return null
  }

  if (isSensitiveEditableElement(getElementForNode(selection.anchorNode))) {
    return null
  }
  if (isSensitiveEditableElement(getElementForNode(selection.focusNode))) {
    return null
  }

  const text = normalizeVisibleText(selection.toString())
  return text ? truncateText(text, maximumLength) : null
}

export class SelectionTracker {
  private state: SelectionState = { text: null, changedAt: 0 }
  private started = false

  public constructor(private readonly now: () => number = () => performance.now()) {}

  public start(): void {
    if (this.started) {
      return
    }

    document.addEventListener("selectionchange", this.handleSelectionChange)
    this.started = true
  }

  public stop(): void {
    if (!this.started) {
      return
    }

    document.removeEventListener("selectionchange", this.handleSelectionChange)
    this.started = false
    this.state = { text: null, changedAt: 0 }
  }

  public getSnapshot(): SelectionState {
    return { ...this.state }
  }

  private readonly handleSelectionChange = (): void => {
    this.state = { text: readDocumentSelection(), changedAt: this.now() }
  }
}
