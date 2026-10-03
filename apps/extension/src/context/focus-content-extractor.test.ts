import type { PageContext } from "@attention-ui/shared"
import { parseHTML } from "linkedom"
import { describe, expect, it } from "vitest"
import {
  extractFocusReaderContent,
  MAX_FOCUS_READER_CHARACTERS
} from "./focus-content-extractor"

const context: PageContext = {
  url: "https://example.test/article",
  pageTitle: "Example",
  text: "A focused paragraph.",
  selectedText: null,
  nearbyHeading: "Nearby heading",
  contextKind: "text",
  numericCandidates: []
}

const parse = (html: string): Document => parseHTML(html).document as unknown as Document

describe("focus reader content extractor", () => {
  it("uses the article heading and extracts safe text blocks", () => {
    const document = parse(`
      <html><head><title>Document title</title></head><body>
        <article><h1>Article title</h1><h2>Section</h2><p id="target">Paragraph text.</p>
        <blockquote>A quote.</blockquote><ul><li>A list item.</li></ul><pre>const safe = true;</pre></article>
      </body></html>
    `)
    const result = extractFocusReaderContent(
      document.querySelector("#target") as HTMLElement,
      context,
      document
    )

    expect(result?.title).toBe("Article title")
    expect(result?.blocks).toEqual([
      { type: "heading", level: 2, text: "Section" },
      { type: "paragraph", text: "Paragraph text." },
      { type: "quote", text: "A quote." },
      { type: "list-item", text: "A list item." },
      { type: "code", text: "const safe = true;" }
    ])
  })

  it("excludes navigation, sidebars, advertisements, and forms", () => {
    const document = parse(`
      <html><head><title>Safe page</title></head><body><main>
        <nav><p>Navigation text</p></nav><aside><p>Sidebar text</p></aside>
        <div class="advert-banner"><p>Advertisement text</p></div>
        <form><p>Form instructions</p><input value="private value"></form>
        <h1>Page heading</h1><p id="target">Readable body text.</p>
      </main></body></html>
    `)
    const result = extractFocusReaderContent(
      document.querySelector("#target") as HTMLElement,
      context,
      document
    )

    expect(result?.blocks).toEqual([{ type: "paragraph", text: "Readable body text." }])
    expect(JSON.stringify(result)).not.toContain("private value")
  })

  it("removes sensitive descendants before reading an allowed text block", () => {
    const document = parse(`
      <html><body><main><p id="target">
        Public start <input value="private input">
        <textarea>private textarea</textarea>
        <span contenteditable="true">private editable</span> public end
      </p></main></body></html>
    `)
    const result = extractFocusReaderContent(
      document.querySelector("#target") as HTMLElement,
      context,
      document
    )
    const serializedResult = JSON.stringify(result)

    expect(result?.blocks).toEqual([{ type: "paragraph", text: "Public start public end" }])
    expect(serializedResult).not.toContain("private input")
    expect(serializedResult).not.toContain("private textarea")
    expect(serializedResult).not.toContain("private editable")
  })

  it("excludes an entire local section that contains sensitive controls", () => {
    const document = parse(`
      <html><body><article>
        <h1>Article title</h1><p id="target">Readable introduction.</p>
        <section class="form-area">
          <h2>Sensitive input area</h2>
          <p>Form instructions must stay out.</p>
          <textarea>private textarea</textarea>
        </section>
        <section><h2>Readable section</h2><p>Readable continuation.</p></section>
      </article></body></html>
    `)
    const result = extractFocusReaderContent(
      document.querySelector("#target") as HTMLElement,
      context,
      document
    )

    expect(result?.blocks).toEqual([
      { type: "paragraph", text: "Readable introduction." },
      { type: "heading", level: 2, text: "Readable section" },
      { type: "paragraph", text: "Readable continuation." }
    ])
    expect(JSON.stringify(result)).not.toContain("Sensitive input area")
    expect(JSON.stringify(result)).not.toContain("Form instructions")
    expect(JSON.stringify(result)).not.toContain("private textarea")
  })

  it("does not count excluded form content when deciding whether main is too large", () => {
    const document = parse(`
      <html><body><main>
        <textarea>${"s".repeat(31_000)}</textarea>
        <h2>Safe section</h2><p id="target">Readable body text.</p>
      </main></body></html>
    `)
    const result = extractFocusReaderContent(
      document.querySelector("#target") as HTMLElement,
      context,
      document
    )

    expect(result?.blocks).toEqual([
      { type: "heading", level: 2, text: "Safe section" },
      { type: "paragraph", text: "Readable body text." }
    ])
    expect(JSON.stringify(result)).not.toContain("s".repeat(100))
  })

  it("returns null when no safe readable blocks exist", () => {
    const document = parse(`<html><body><main><form><button id="target">Submit</button></form></main></body></html>`)

    expect(
      extractFocusReaderContent(document.querySelector("#target") as HTMLElement, context, document)
    ).toBeNull()
  })

  it("falls back to nearby heading and truncates very long content", () => {
    const document = parse(`<html><body><p id="target">${"x".repeat(20_000)}</p></body></html>`)
    const result = extractFocusReaderContent(
      document.querySelector("#target") as HTMLElement,
      context,
      document
    )
    const characterCount = result?.blocks.reduce((total, block) => total + Array.from(block.text).length, 0)

    expect(result?.title).toBe("Nearby heading")
    expect(characterCount).toBe(MAX_FOCUS_READER_CHARACTERS)
  })
})
