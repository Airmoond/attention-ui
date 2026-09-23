import type { AttentionCandidate } from "../attention/attention-engine"
import { isExcludedFromAttention, normalizeVisibleText, truncateText } from "../context/semantic-block"

const excluded = "input,textarea,select,option,button,form,[contenteditable],[hidden],[inert],[aria-hidden='true'],#focus-ui-host"

// A manual selection may be one word or span paragraphs. Reject the whole range
// if it crosses editable/private content, before ever reading its text.
export function getManualCandidate(): AttentionCandidate | null {
  const selection = document.getSelection()
  if (!selection || selection.isCollapsed || selection.rangeCount !== 1) return null
  const range = selection.getRangeAt(0)
  const parent = (node: Node): HTMLElement | null => node instanceof HTMLElement ? node : node.parentElement
  const first = parent(range.startContainer)
  const last = parent(range.endContainer)
  if (!first || !last || isExcludedFromAttention(first) || isExcludedFromAttention(last)) return null
  const scope = parent(range.commonAncestorContainer)
  if (!scope) return null
  if (Array.from(scope.querySelectorAll(excluded)).some(node => range.intersectsNode(node))) return null
  const text = truncateText(normalizeVisibleText(range.toString()), 1500)
  if (!text || !/[\p{L}\p{N}]/u.test(text)) return null
  const rect = range.getBoundingClientRect()
  if (!rect.width || !rect.height) return null
  return { element: first, rect, text, kind: "paragraph", pointerX: rect.left,
    pointerY: rect.bottom, triggeredAt: performance.now() }
}
