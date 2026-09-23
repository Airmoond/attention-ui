import type { PDFPageProxy } from "pdfjs-dist"
import type { TextItem } from "pdfjs-dist/types/src/display/api"
import { z } from "../../../node_modules/zod/index.js"

type View = { number: number; page: PDFPageProxy; shell: HTMLElement; text: HTMLDivElement; textReady: boolean }
type Box = { x: number; y: number; w: number; h: number }
type Segment = { kind: "text"; text: string; page: number } | {
  kind: "formula"; page: number; box: Box; view: View; original: string; image?: string; latex?: string
}
const mathFont = /CMMI|CMSY|CMEX|MSAM|MSBM|Math|Symbol/i
const shortMath = /^(?:[\d\s.,;:()[\]{}+=\-−/|<>*^!]+|exp|log|ln|sin|cos|tan|lim)$/u
const replySchema = z.object({ results: z.array(z.union([
  z.object({ latex: z.string().min(1).max(8000), seconds: z.number().nonnegative() }),
  z.object({ error: z.string() })
])).max(12) })

// Match the public text content stream against the rendered spans. A mismatch
// disables detection for this page instead of assigning the wrong formula font.
export async function annotateFormulaFonts(page: PDFPageProxy, layer: HTMLDivElement): Promise<void> {
  const content = await page.getTextContent()
  const items = content.items.filter((item): item is TextItem => "str" in item && item.str !== "")
  const spans = Array.from(layer.querySelectorAll<HTMLSpanElement>("span"))
  if (items.length !== spans.length || items.some((item, i) => item.str !== spans[i]!.textContent)) return
  items.forEach((item, i) => {
    const font: unknown = page.commonObjs.has(item.fontName) ? page.commonObjs.get(item.fontName) : null
    if (typeof font === "object" && font && "name" in font && typeof font.name === "string") {
      spans[i]!.dataset.pdfFont = font.name
    }
    spans[i]!.dataset.eol = item.hasEOL ? "1" : "0"
  })
}

function groups(view: View): HTMLSpanElement[][] {
  const result: HTMLSpanElement[][] = []
  let run: HTMLSpanElement[] = []
  let seeded = false
  const flush = (): void => { if (seeded && run.length) result.push(run); run = []; seeded = false }
  for (const span of view.text.querySelectorAll<HTMLSpanElement>("span")) {
    const text = span.textContent?.trim() ?? ""
    if (!text) continue
    const math = mathFont.test(span.dataset.pdfFont ?? "") && !/[A-Za-z]{4,}/.test(text)
    if (!math && !shortMath.test(text)) { flush(); continue }
    if (run.length) {
      const rect = span.getBoundingClientRect()
      const previous = run[run.length - 1]!.getBoundingClientRect()
      const em = Math.max(rect.height, previous.height)
      const dx = Math.max(rect.left - previous.right, previous.left - rect.right, 0)
      const dy = Math.max(rect.top - previous.bottom, previous.top - rect.bottom, 0)
      if (dx > em * 5 || dy > em * 1.1) flush()
    }
    run.push(span)
    seeded ||= math
  }
  flush()
  return result
}

function selectedText(range: Range, span: HTMLElement): string {
  if (!range.intersectsNode(span)) return ""
  const part = document.createRange()
  part.selectNodeContents(span)
  if (range.compareBoundaryPoints(Range.START_TO_START, part) > 0) part.setStart(range.startContainer, range.startOffset)
  if (range.compareBoundaryPoints(Range.END_TO_END, part) < 0) part.setEnd(range.endContainer, range.endOffset)
  return part.toString()
}

function segmentsFor(range: Range, views: View[]): Segment[] {
  const segments: Segment[] = []
  let total = 0
  for (const view of views) {
    if (!view.textReady || !range.intersectsNode(view.text)) continue
    const spans = Array.from(view.text.querySelectorAll<HTMLSpanElement>("span"))
    const membership = new Map<HTMLSpanElement, HTMLSpanElement[]>()
    for (const group of groups(view)) {
      if (group.some(span => selectedText(range, span))) group.forEach(span => membership.set(span, group))
    }
    const emitted = new Set<HTMLSpanElement[]>()
    for (const span of spans) {
      const group = membership.get(span)
      if (group) {
        if (emitted.has(group)) continue
        emitted.add(group)
        const rects = group.map(node => node.getBoundingClientRect())
        const paper = view.shell.getBoundingClientRect()
        const unit = view.page.getViewport({ scale: 1 })
        const factor = unit.width / paper.width
        const padding = Math.max(...rects.map(rect => rect.height)) * 0.08
        const left = Math.max(0, Math.min(...rects.map(rect => rect.left)) - paper.left - padding)
        const top = Math.max(0, Math.min(...rects.map(rect => rect.top)) - paper.top - padding)
        const right = Math.min(paper.width, Math.max(...rects.map(rect => rect.right)) - paper.left + padding)
        const bottom = Math.min(paper.height, Math.max(...rects.map(rect => rect.bottom)) - paper.top + padding)
        segments.push({ kind: "formula", page: view.number, view,
          box: { x: left * factor, y: top * factor, w: (right - left) * factor, h: (bottom - top) * factor },
          original: group.map(node => node.textContent).join("") })
        total += group.reduce((sum, node) => sum + (node.textContent?.length ?? 0), 0)
      } else {
        const text = selectedText(range, span)
        if (!text) continue
        const value = text + (span.dataset.eol === "1" ? "\n" : "")
        const previous = segments[segments.length - 1]
        if (previous?.kind === "text" && previous.page === view.number) previous.text += value
        else segments.push({ kind: "text", text: value, page: view.number })
        total += text.length
      }
      if (total >= 1500) return segments
    }
    if (segments.length) segments.push({ kind: "text", text: "\n", page: view.number })
  }
  return segments
}

export function createFormulaSelection() {
  const panel = document.createElement("section")
  panel.id = "formula-panel"
  panel.hidden = true
  const heading = document.createElement("h3")
  heading.textContent = "文字与公式"
  const note = document.createElement("p")
  note.textContent = "触及公式时保留整式原图；本机识别结果需对照核对，不自动发送。"
  const preview = document.createElement("div")
  preview.id = "formula-preview"
  const message = document.createElement("p")
  message.id = "formula-status"
  message.setAttribute("role", "status")
  const recognize = document.createElement("button")
  recognize.id = "recognize-formulas"
  recognize.textContent = "本机识别公式"
  const copy = document.createElement("button")
  copy.id = "copy-mixed"
  copy.textContent = "复制文字与公式"
  copy.disabled = true
  const results = document.createElement("div")
  results.id = "formula-results"
  panel.append(heading, note, preview, message, recognize, copy, results)
  document.getElementById("pin")!.before(panel)
  const style = document.createElement("style")
  style.textContent = `#formula-panel{border-top:1px solid #dce2eb;margin:12px 0;padding-top:8px}#formula-preview,.saved-mixed{white-space:pre-wrap;line-height:1.8;overflow-wrap:anywhere;font-size:14px}#formula-preview img,.saved-mixed img{max-width:100%;max-height:180px;object-fit:contain;vertical-align:middle;background:white}#formula-panel p{font-size:12px;color:#536682}#formula-panel button{margin:4px 4px 4px 0;font-size:13px}#formula-results textarea{width:100%;min-height:65px;font:12px monospace}#formula-results summary{font-size:13px;cursor:pointer}`
  document.head.append(style)
  let segments: Segment[] = []
  let lastRange: Range | null = null
  let generation = 0
  let controller: AbortController | null = null
  let cropTask: ReturnType<PDFPageProxy["render"]> | null = null
  const raw = document.getElementById("selection")!
  const serialize = (): string => segments.map(part => part.kind === "text" ? part.text :
    part.latex ? "\\(" + part.latex + "\\)" : "【公式待核对：第 " + part.page + " 页】").join("")
  function clear(): void {
    generation++
    controller?.abort()
    cropTask?.cancel()
    cropTask = null
    controller = null
    segments = []
    lastRange = null
    panel.hidden = true
    raw.hidden = false
    preview.replaceChildren()
    results.replaceChildren()
    copy.disabled = true
  }
  function renderPreview(): void {
    preview.replaceChildren()
    for (const segment of segments) {
      if (segment.kind === "text") preview.append(document.createTextNode(segment.text))
      else if (segment.image) {
        const img = document.createElement("img")
        img.src = segment.image
        img.alt = "第 " + segment.page + " 页公式原图"
        img.title = "公式原图，尚未代表识别正确"
        // Preserve inline layout for short math and allow display equations to wrap.
        img.style.width = Math.max(12, segment.box.w * 1.35) + "px"
        preview.append(img)
      } else preview.append(document.createTextNode("【公式图像准备中】"))
    }
  }
  async function capture(range: Range, views: View[]): Promise<void> {
    if (lastRange && range.compareBoundaryPoints(Range.START_TO_START, lastRange) === 0 &&
        range.compareBoundaryPoints(Range.END_TO_END, lastRange) === 0) return
    clear()
    lastRange = range.cloneRange()
    segments = segmentsFor(range, views)
    const formulas = segments.filter(part => part.kind === "formula")
    if (!formulas.length) return
    panel.hidden = false
    raw.hidden = true
    recognize.disabled = true
    message.textContent = "正在准备 " + formulas.length + " 处公式原图…"
    const version = generation
    renderPreview()
    try {
      for (const part of formulas) {
        const factor = 3
        const canvas = document.createElement("canvas")
        canvas.width = Math.ceil(part.box.w * factor)
        canvas.height = Math.ceil(part.box.h * factor)
        if (canvas.width * canvas.height > 4_000_000 || !canvas.width || !canvas.height) throw new Error("CROP_TOO_LARGE")
        cropTask = part.view.page.render({ canvas, viewport: part.view.page.getViewport({ scale: factor }),
          transform: [1, 0, 0, 1, -part.box.x * factor, -part.box.y * factor] })
        await cropTask.promise
        if (version !== generation) { canvas.width = canvas.height = 0; return }
        part.image = canvas.toDataURL("image/png")
        canvas.width = canvas.height = 0
      }
      cropTask = null
      renderPreview()
      message.textContent = formulas.length > 12 ? "选区公式超过 12 处，请缩小选区后识别。" : "已保留 " + formulas.length + " 处公式原图，可在本机补全文本。"
      recognize.disabled = formulas.length > 12
    } catch {
      if (version === generation) message.textContent = "公式原图准备失败，请重新选择较短的段落。"
    }
  }
  recognize.addEventListener("click", () => { void (async () => {
    const version = generation
    const formulas = segments.filter(part => part.kind === "formula")
    controller?.abort()
    controller = new AbortController()
    const requestController = controller
    const timer = setTimeout(() => requestController.abort(), 95_000)
    recognize.disabled = true
    copy.disabled = true
    message.textContent = "正在本机识别，选区内容不会上传…"
    try {
      const session = await fetch("/__formula/session", { signal: requestController.signal }).then(response => response.json())
      const token = z.object({ token: z.string().length(64), available: z.literal(true) }).parse(session).token
      const response = await fetch("/__formula/recognize", { method: "POST", signal: requestController.signal,
        headers: { "Content-Type": "application/json", "X-Formula-Token": token },
        body: JSON.stringify({ images: formulas.map(part => part.image) }) })
      if (!response.ok) throw new Error("LOCAL_OCR_FAILED")
      const result = replySchema.parse(await response.json())
      if (result.results.length !== formulas.length) throw new Error("RESULT_COUNT")
      if (version !== generation) return
      results.replaceChildren()
      result.results.forEach((value, index) => {
        const part = formulas[index]!
        if (!("latex" in value)) return
        part.latex = value.latex
        const details = document.createElement("details")
        const summary = document.createElement("summary")
        summary.textContent = "公式 " + (index + 1) + " · 第 " + part.page + " 页 · 查看/校正"
        const input = document.createElement("textarea")
        input.setAttribute("aria-label", "公式 " + (index + 1) + " LaTeX")
        input.value = value.latex
        input.maxLength = 8000
        input.addEventListener("input", () => {
          part.latex = input.value.trim()
          copy.disabled = !formulas.every(item => item.latex)
        })
        details.append(summary, input)
        results.append(details)
      })
      copy.disabled = !formulas.every(part => part.latex)
      message.textContent = copy.disabled ? "部分公式识别失败，请保留原图并缩小选区重试。" : "识别完成，结果待核对；可展开校正后复制文字与公式。"
    } catch {
      if (version === generation) message.textContent = "本机识别未完成，请确认识别组件已安装，或缩小选区重试。"
    } finally {
      clearTimeout(timer)
      if (version === generation) recognize.disabled = false
    }
  })() })
  copy.addEventListener("click", () => { void navigator.clipboard.writeText(serialize()).then(() => {
    message.textContent = "已复制文字与 LaTeX 公式，请核对后使用。"
  }).catch(() => { message.textContent = "复制失败，请展开公式结果手动复制。" }) })
  return {
    capture, clear,
    saveText: (fallback: string): string => panel.hidden ? fallback : serialize(),
    savePreview: (): void => {
      document.querySelector(".saved-mixed")?.remove()
      const savedText = document.getElementById("saved-text")!
      savedText.hidden = !panel.hidden
      if (!panel.hidden) {
        const snapshot = preview.cloneNode(true) as HTMLDivElement
        snapshot.removeAttribute("id")
        snapshot.className = "saved-mixed"
        savedText.after(snapshot)
      }
    },
    resetSaved: (): void => { document.querySelector(".saved-mixed")?.remove(); document.getElementById("saved-text")!.hidden = false }
  }
}
