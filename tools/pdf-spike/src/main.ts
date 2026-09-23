import { getDocument, GlobalWorkerOptions, TextLayerImages, type PDFDocumentLoadingTask, type PDFDocumentProxy, type PDFPageProxy } from "pdfjs-dist"
import { TextLayerBuilder } from "pdfjs-dist/web/pdf_viewer.mjs"
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url"
import "./style.css"

GlobalWorkerOptions.workerSrc = workerUrl
const element = <T extends HTMLElement>(id: string): T => {
  const found = document.getElementById(id)
  if (!found) throw new Error("Missing element: " + id)
  return found as T
}
const fileInput = element<HTMLInputElement>("file")
const status = element<HTMLParagraphElement>("status")
const pageInput = element<HTMLInputElement>("page")
const close = element<HTMLButtonElement>("close")
const pagesContainer = element<HTMLDivElement>("pages")
const viewport = element<HTMLElement>("viewport")
const zoomIn = element<HTMLButtonElement>("zoom-in")
const zoomOut = element<HTMLButtonElement>("zoom-out")
const fit = element<HTMLButtonElement>("fit")
const fullScreen = element<HTMLButtonElement>("fullscreen")
const pin = element<HTMLButtonElement>("pin")
const bar = document.querySelector<HTMLElement>(".reader-bar")!
type Excerpt = { startPage: number; endPage: number; text: string; truncated: boolean }
type PageView = {
  number: number; page: PDFPageProxy; width: number; height: number
  shell: HTMLElement; canvas: HTMLCanvasElement; text: HTMLDivElement; hint: HTMLParagraphElement
  textLayer: TextLayerBuilder | null; render: ReturnType<PDFPageProxy["render"]> | null
  textReady: boolean; painted: boolean; inRange: boolean; hasText: boolean; error: string | null
}
let loading: PDFDocumentLoadingTask | null = null
let documentPdf: PDFDocumentProxy | null = null
let views: PageView[] = []
let documentVersion = 0
let layoutVersion = 0
let pageNumber = 1
let scale = 1
let ready = false
let selection: Excerpt | null = null
let saved: Excerpt | null = null
let rendering = false
let pendingRender = false
let observer: IntersectionObserver | null = null
let scrollFrame = 0

const sourceLabel = (excerpt: Excerpt): string => excerpt.startPage === excerpt.endPage
  ? "来源：第 " + excerpt.startPage + " 页"
  : "来源：第 " + excerpt.startPage + "–" + excerpt.endPage + " 页"
function updateControls(): void {
  pageInput.disabled = fit.disabled = !ready
  zoomIn.disabled = !ready || scale >= 3
  zoomOut.disabled = !ready || scale <= 0.5
  close.disabled = loading === null
  pin.disabled = !selection || !ready
  element("zoom-value").textContent = Math.round(scale * 100) + "%"
  element("page-count").textContent = documentPdf ? "/ " + documentPdf.numPages : "/ —"
}
function updateStatus(): void {
  if (!ready || !documentPdf) return
  const view = views[pageNumber - 1]
  const detail = view?.error ?? (view?.textReady
    ? view.hasText ? "可选择文字" : "此页无可提取文字，暂不支持扫描件 OCR"
    : "正在绘制…")
  status.textContent = "第 " + pageNumber + " / " + documentPdf.numPages + " 页 · " + detail
}
function clearSelection(): void {
  selection = null
  document.getSelection()?.removeAllRanges()
  element("selection").textContent = ""
  element("selection-page").textContent = "尚未选择"
  pin.disabled = true
}
function clearBitmap(view: PageView): void {
  view.canvas.width = view.canvas.height = 0
  view.painted = false
  if (!view.error) view.shell.dataset.state = "pending"
}
async function dispose(): Promise<void> {
  const oldTask = loading
  loading = null
  documentPdf = null
  ready = false
  layoutVersion++
  observer?.disconnect()
  observer = null
  for (const view of views) {
    view.render?.cancel()
    view.textLayer?.cancel()
    clearBitmap(view)
  }
  views = []
  pagesContainer.replaceChildren()
  clearSelection()
  saved = null
  element("saved").hidden = true
  element("saved-text").textContent = ""
  pageNumber = 1
  pageInput.value = "1"
  updateControls()
  if (oldTask) await oldTask.destroy()
}
function sizePage(view: PageView): void {
  const size = view.page.getViewport({ scale })
  view.shell.style.width = size.width + "px"
  view.shell.style.height = size.height + "px"
  view.shell.style.setProperty("--scale-factor", String(scale))
  view.shell.style.setProperty("--total-scale-factor", String(scale))
}
function currentAnchor(): { number: number; offset: number } | null {
  const view = views[pageNumber - 1]
  if (!view) return null
  return { number: pageNumber, offset: (bar.getBoundingClientRect().bottom - view.shell.getBoundingClientRect().top) / view.shell.offsetHeight }
}
function restoreAnchor(anchor: ReturnType<typeof currentAnchor>): void {
  if (!anchor) return
  const view = views[anchor.number - 1]
  if (!view) return
  const delta = view.shell.getBoundingClientRect().top + anchor.offset * view.shell.offsetHeight - bar.getBoundingClientRect().bottom
  window.scrollBy({ top: delta, behavior: "instant" })
}
function refreshVisiblePages(): void {
  scrollFrame = 0
  if (!ready) return
  const top = bar.getBoundingClientRect().bottom + 10
  let closest = views[0]
  let best = Infinity
  for (const view of views) {
    const rect = view.shell.getBoundingClientRect()
    const distance = rect.top <= top && rect.bottom > top ? 0 : Math.min(Math.abs(rect.top - top), Math.abs(rect.bottom - top))
    if (distance < best) { best = distance; closest = view }
  }
  if (closest) {
    pageNumber = closest.number
    if (document.activeElement !== pageInput) pageInput.value = String(pageNumber)
    updateStatus()
  }
  requestRender()
}
function queueVisibleUpdate(): void {
  if (!scrollFrame) scrollFrame = requestAnimationFrame(refreshVisiblePages)
}
function releaseDistantBitmaps(): void {
  // Keep text layers to preserve native cross-page selections, but not full-document bitmaps.
  const painted = views.filter(view => view.painted).sort((a, b) => Math.abs(a.number - pageNumber) - Math.abs(b.number - pageNumber))
  let pixels = 0
  for (let i = 0; i < painted.length; i++) {
    const view = painted[i]!
    const size = view.canvas.width * view.canvas.height
    if (!view.inRange || i >= 5 || (i > 0 && pixels + size > 24_000_000)) clearBitmap(view)
    else pixels += size
  }
}
async function paintPage(view: PageView, version: number, layout: number): Promise<void> {
  const valid = (): boolean => version === documentVersion && layout === layoutVersion
  const size = view.page.getViewport({ scale })
  const ratio = Math.min(window.devicePixelRatio || 1, 2)
  try {
    if (size.width * size.height * ratio * ratio > 16_000_000) throw new Error("PAGE_TOO_LARGE")
    view.canvas.width = Math.ceil(size.width * ratio)
    view.canvas.height = Math.ceil(size.height * ratio)
    view.canvas.style.width = size.width + "px"
    view.canvas.style.height = size.height + "px"
    const context = view.canvas.getContext("2d")
    if (!context) throw new Error("CANVAS_UNAVAILABLE")
    view.render = view.page.render({ canvas: view.canvas, canvasContext: context, viewport: size, transform: [ratio, 0, 0, ratio, 0, 0] })
    await view.render.promise
    if (!valid()) return
    view.render = null
    view.painted = true
    if (!view.textReady) {
      // The viewer builder supplies selection boundaries and mouse/copy handling.
      // Raw TextLayer alone lets a drag into whitespace jump to unrelated content.
      const builder = new TextLayerBuilder({ pdfPage: view.page })
      view.textLayer = builder
      view.text.replaceWith(builder.div)
      view.text = builder.div
      await builder.render({ viewport: size, textContentParams: { disableNormalization: false },
        // Image-copy overlays are not used in this text-selection experiment.
        images: new TextLayerImages(0, new Float32Array(), size, () => view.canvas) })
      if (!valid()) { builder.cancel(); return }
      view.hasText = Boolean(view.text.textContent?.trim())
      view.textReady = true
    }
    view.shell.dataset.state = "ready"
  } catch (error: unknown) {
    if (!valid()) return
    view.error = error instanceof Error && error.message === "PAGE_TOO_LARGE"
      ? "此页尺寸过大，请缩小显示比例" : "此页显示失败，请更换文档"
    view.hint.textContent = view.error
    view.shell.dataset.state = "error"
    clearBitmap(view)
  } finally {
    if (valid()) { updateStatus(); releaseDistantBitmaps() }
  }
}
function requestRender(): void {
  pendingRender = true
  if (!rendering) void drainRenderQueue()
}
async function drainRenderQueue(): Promise<void> {
  rendering = true
  try {
    while (pendingRender) {
      pendingRender = false
      const version = documentVersion
      const layout = layoutVersion
      // Prioritize current/adjacent pages and cap active canvas work.
      const candidates = views.filter(view => view.inRange && !view.error && !view.painted)
        .sort((a, b) => Math.abs(a.number - pageNumber) - Math.abs(b.number - pageNumber)).slice(0, 5)
      for (const view of candidates) {
        if (version !== documentVersion || layout !== layoutVersion) break
        if (!view.inRange) continue
        await paintPage(view, version, layout)
      }
    }
  } finally { rendering = false }
}
function observePages(): void {
  observer?.disconnect()
  observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      const view = views[Number((entry.target as HTMLElement).dataset.page) - 1]
      if (view && view.shell === entry.target) view.inRange = entry.isIntersecting
    }
    releaseDistantBitmaps()
    requestRender()
  }, { rootMargin: "900px 0px" })
  for (const view of views) observer.observe(view.shell)
}
async function openFile(file: File): Promise<void> {
  const version = ++documentVersion
  try {
    await dispose()
    if (version !== documentVersion) return
    if (file.size > 20 * 1024 * 1024) { status.textContent = "文件超过 20 MB 验证上限"; return }
    status.textContent = "正在本地读取…"
    const bytes = new Uint8Array(await file.arrayBuffer())
    if (version !== documentVersion) return
    if (!new TextDecoder().decode(bytes.subarray(0, 1024)).includes("%PDF-")) { status.textContent = "文件不是有效 PDF"; return }
    const task = getDocument({ data: bytes, cMapUrl: "/pdf-assets/cmaps/", cMapPacked: true,
      standardFontDataUrl: "/pdf-assets/standard_fonts/", wasmUrl: "/pdf-assets/wasm/", useSystemFonts: false })
    loading = task
    updateControls()
    const pdf = await task.promise
    if (version !== documentVersion) return
    if (pdf.numPages > 120) { await dispose(); if (version === documentVersion) status.textContent = "文档超过 120 页验证上限"; return }
    documentPdf = pdf
    scale = 1
    // Read page dimensions first so scrolling/zoom never shifts due to guessed paper sizes.
    for (let n = 1; n <= pdf.numPages; n++) {
      const page = await pdf.getPage(n)
      if (version !== documentVersion) return
      const dimensions = page.getViewport({ scale: 1 })
      const shell = document.createElement("section")
      shell.className = "pdf-page"
      shell.dataset.page = String(n)
      shell.dataset.state = "pending"
      shell.setAttribute("aria-label", "第 " + n + " 页")
      const canvas = document.createElement("canvas")
      canvas.setAttribute("aria-hidden", "true")
      canvas.width = canvas.height = 0
      const text = document.createElement("div")
      text.className = "textLayer"
      const hint = document.createElement("p")
      hint.className = "page-hint"
      hint.textContent = "第 " + n + " 页 · 正在准备…"
      shell.append(canvas, text, hint)
      const view: PageView = { number: n, page, width: dimensions.width, height: dimensions.height, shell, canvas, text, hint,
        textLayer: null, render: null, textReady: false, painted: false, inRange: n === 1, hasText: false, error: null }
      sizePage(view)
      views.push(view)
      pagesContainer.append(shell)
    }
    pageNumber = 1
    pageInput.max = String(pdf.numPages)
    ready = true
    updateControls()
    observePages()
    jumpToPage(1)
    requestRender()
  } catch (error: unknown) {
    if (version !== documentVersion) return
    const encrypted = error instanceof Error && error.name === "PasswordException"
    await dispose()
    if (version === documentVersion) status.textContent = encrypted ? "加密 PDF 暂不支持，请选择未加密的副本" : "PDF 无法读取，文件可能损坏"
  }
}
function jumpToPage(number: number): void {
  const view = views[number - 1]
  if (!view || !ready) return
  pageNumber = number
  pageInput.value = String(number)
  view.inRange = true
  view.shell.scrollIntoView({ block: "start", behavior: "instant" })
  updateStatus()
  requestRender()
}
function changeScale(nextScale: number): void {
  if (!ready) return
  const target = Math.max(0.5, Math.min(3, nextScale))
  if (Math.abs(scale - target) < 0.001) return
  const anchor = currentAnchor()
  layoutVersion++
  scale = target
  clearSelection()
  for (const view of views) {
    view.render?.cancel()
    view.textLayer?.cancel()
    view.text.replaceChildren()
    view.textReady = false
    view.textLayer = null
    view.error = null
    view.shell.dataset.state = "pending"
    view.hint.textContent = "第 " + view.number + " 页 · 正在准备…"
    // A cancelled render finishes before the queued repaint touches the same canvas.
    clearBitmap(view)
    sizePage(view)
  }
  restoreAnchor(anchor)
  updateControls()
  observePages()
  refreshVisiblePages()
}
function toggleFullscreen(force?: boolean): void {
  const anchor = currentAnchor()
  const enabled = force ?? !document.body.classList.contains("reading-fullscreen")
  document.body.classList.toggle("reading-fullscreen", enabled)
  fullScreen.setAttribute("aria-pressed", String(enabled))
  fullScreen.textContent = enabled ? "退出网页全屏" : "网页全屏"
  document.documentElement.style.setProperty("--bar-height", bar.offsetHeight + "px")
  restoreAnchor(anchor)
  queueVisibleUpdate()
}
function pageForNode(node: Node | null): PageView | undefined {
  const parent = node instanceof Element ? node : node?.parentElement
  const layer = parent?.closest(".textLayer")
  if (!layer || !pagesContainer.contains(layer)) return undefined
  const shell = layer.closest<HTMLElement>(".pdf-page")
  return shell ? views[Number(shell.dataset.page) - 1] : undefined
}
function captureSelection(): void {
  if (!ready) return
  const current = document.getSelection()
  if (!current || current.isCollapsed || !current.rangeCount) return
  if (!pageForNode(current.anchorNode) || !pageForNode(current.focusNode)) return
  const range = current.getRangeAt(0)
  let text = ""
  let startPage = 0
  let endPage = 0
  let truncated = false
  for (const view of views) {
    if (!view.textReady || !range.intersectsNode(view.text)) continue
    const part = document.createRange()
    part.selectNodeContents(view.text)
    if (range.compareBoundaryPoints(Range.START_TO_START, part) > 0) part.setStart(range.startContainer, range.startOffset)
    if (range.compareBoundaryPoints(Range.END_TO_END, part) < 0) part.setEnd(range.endContainer, range.endOffset)
    const fragment = part.cloneContents()
    fragment.querySelectorAll("br").forEach(br => br.replaceWith(document.createTextNode("\n")))
    const excerpt = fragment.textContent?.trim() ?? ""
    if (!excerpt) continue
    const separator = text ? "\n\n" : ""
    const remaining = 1500 - Array.from(text + separator).length
    if (remaining <= 0) { truncated = true; break }
    const characters = Array.from(excerpt)
    text += separator + characters.slice(0, remaining).join("")
    startPage ||= view.number
    endPage = view.number
    if (characters.length > remaining) { truncated = true; break }
  }
  if (!text) return
  selection = { startPage, endPage, text, truncated }
  element("selection").textContent = text
  element("selection-page").textContent = sourceLabel(selection) + (truncated ? "（已截取前 1500 字）" : "")
  updateControls()
}
fileInput.addEventListener("change", () => { const file = fileInput.files?.[0]; if (file) void openFile(file) })
close.addEventListener("click", () => {
  const version = ++documentVersion
  void dispose().then(() => {
    if (version !== documentVersion) return
    fileInput.value = ""
    status.textContent = "文档已关闭，片段已清除"
  }).catch(() => { status.textContent = "文档资源清理失败，请刷新验证页" })
})
pageInput.addEventListener("change", () => {
  const number = Number(pageInput.value)
  if (Number.isInteger(number) && number >= 1 && number <= views.length) jumpToPage(number)
  else pageInput.value = String(pageNumber)
})
zoomIn.addEventListener("click", () => changeScale(Math.round((scale + 0.25) * 100) / 100))
zoomOut.addEventListener("click", () => changeScale(Math.round((scale - 0.25) * 100) / 100))
fit.addEventListener("click", () => {
  const view = views[pageNumber - 1]
  if (view) changeScale((viewport.clientWidth - parseFloat(getComputedStyle(viewport).paddingLeft) * 2) / view.width)
})
fullScreen.addEventListener("click", () => toggleFullscreen())
document.addEventListener("keydown", event => {
  if (event.key === "Escape" && document.body.classList.contains("reading-fullscreen")) toggleFullscreen(false)
})
// The boundary guard prevents page-wide jumps; snap a release in horizontal
// whitespace to the nearest line edge so the first/last characters are included.
let selectingText = false
document.addEventListener("pointerdown", event => {
  const target = event.target
  // Clear at the start of a blank-area click, never when a text drag ends there.
  // Buttons and excerpt text retain their normal save/copy interactions.
  if (event.button === 0 && !event.shiftKey && target instanceof Element &&
      target.matches("body, main, header, aside, .layout, #viewport, #pages, .pdf-page, .textLayer, .textLayerImages, .endOfContent")) {
    clearSelection()
  }
})
pagesContainer.addEventListener("pointerdown", event => {
  selectingText = event.button === 0 && Boolean(pageForNode(event.target as Node))
})
document.addEventListener("pointerup", event => {
  if (selectingText) {
    const current = document.getSelection()
    const view = pageForNode(event.target as Node)
    const target = event.target
    if (view && current && !current.isCollapsed && pageForNode(current.anchorNode) &&
        target instanceof Element && (target === view.text || target.matches(".endOfContent, .textLayerImages"))) {
      const candidates = Array.from(view.text.querySelectorAll("span"))
        .filter(span => span.firstChild instanceof Text && span.textContent?.trim())
        .map(span => ({ span, rect: span.getBoundingClientRect() }))
        .filter(({ rect }) => event.clientY >= rect.top && event.clientY <= rect.bottom)
        .sort((a, b) => Math.min(Math.abs(event.clientX - a.rect.left), Math.abs(event.clientX - a.rect.right)) -
          Math.min(Math.abs(event.clientX - b.rect.left), Math.abs(event.clientX - b.rect.right)))
      const nearest = candidates[0]
      if (nearest && (event.clientX < nearest.rect.left || event.clientX > nearest.rect.right)) {
        const node = nearest.span.firstChild as Text
        current.setBaseAndExtent(current.anchorNode!, current.anchorOffset, node,
          event.clientX < nearest.rect.left ? 0 : node.length)
      }
    }
  }
  selectingText = false
  captureSelection()
})
window.addEventListener("blur", () => { selectingText = false })
document.addEventListener("pointercancel", () => { selectingText = false })
document.addEventListener("keyup", captureSelection)
pin.addEventListener("click", () => {
  if (!selection) return
  saved = { ...selection }
  element("saved-page").textContent = sourceLabel(saved)
  element("saved-text").textContent = saved.text
  element("saved").hidden = false
})
element("return").addEventListener("click", () => { if (saved) jumpToPage(saved.startPage) })
window.addEventListener("scroll", queueVisibleUpdate, { passive: true })
window.addEventListener("resize", queueVisibleUpdate)
new ResizeObserver(() => {
  document.documentElement.style.setProperty("--bar-height", bar.offsetHeight + "px")
}).observe(bar)
