import { parseHTML } from "linkedom"
import { afterEach, describe, expect, it, vi } from "vitest"
import { readDocumentSelection } from "./selection-tracker"

function selection(middle: string, intersects = true) {
  const { document, Element, ShadowRoot } = parseHTML(`<html><body><article><p id="first">First</p>${middle}<p id="last">Last</p></article></body></html>`)
  const text = vi.fn(() => "First private Last")
  const range = { commonAncestorContainer: document.querySelector("article"), intersectsNode: () => intersects, toString: text }
  const value = { isCollapsed: false, rangeCount: 1, anchorNode: document.querySelector("#first")!.firstChild,
    focusNode: document.querySelector("#last")!.firstChild, getRangeAt: () => range }
  vi.stubGlobal("Element", Element); vi.stubGlobal("ShadowRoot", ShadowRoot)
  vi.stubGlobal("document", { getSelection: () => value })
  return { text, value, range }
}
afterEach(() => vi.unstubAllGlobals())
describe("selection privacy across the entire range", () => {
  it.each(['<div contenteditable="true">secret</div>', '<div contenteditable="plaintext-only">secret</div>', '<input type="password" value="secret">', '<textarea>secret</textarea>', '<form>private</form>', '<div hidden>secret</div>'])("rejects crossed private content before reading text: %s", html => {
    const { text } = selection(html)
    expect(readDocumentSelection()).toBeNull()
    expect(text).not.toHaveBeenCalled()
  })
  it("accepts normal paragraph ranges and truncates to the limit", () => {
    const { text } = selection("<p>ordinary</p>")
    text.mockReturnValue("A".repeat(1600))
    expect(readDocumentSelection()).toHaveLength(1500)
  })
  it("does not reject a safe range merely because unrelated inputs share the article", () => {
    const { text } = selection('<textarea>outside selection</textarea>', false)
    text.mockReturnValue("Selected words")
    expect(readDocumentSelection()).toBe("Selected words")
  })
  it("fails closed for detached ranges and multiple selections", () => {
    const { text, range, value } = selection('<input>')
    range.intersectsNode = () => { throw new Error("detached") }
    expect(readDocumentSelection()).toBeNull()
    value.rangeCount = 2
    expect(readDocumentSelection()).toBeNull()
    expect(text).not.toHaveBeenCalled()
  })
})
