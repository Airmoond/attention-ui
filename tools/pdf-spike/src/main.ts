import { getDocument, GlobalWorkerOptions, TextLayer, type PDFDocumentLoadingTask, type PDFDocumentProxy } from "pdfjs-dist"
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
const zoom = element<HTMLSelectElement>("zoom")
const previous = element<HTMLButtonElement>("prev")
const next = element<HTMLButtonElement>("next")
const close = element<HTMLButtonElement>("close")
const surface = element<HTMLDivElement>("surface")
const canvas = element<HTMLCanvasElement>("canvas")
const textContainer = element<HTMLDivElement>("text-layer")
const pin = element<HTMLButtonElement>("pin")
type Excerpt = { page: number; text: string }
let documentPdf: PDFDocumentProxy | null = null
let loading: PDFDocumentLoadingTask | null = null
let textLayer: TextLayer | null = null
let rendering: ReturnType<Awaited<ReturnType<PDFDocumentProxy["getPage"]>>["render"]> | null = null
let version = 0
let pageNumber = 1
let selection: Excerpt | null = null
let saved: Excerpt | null = null
let busy = false
let renderQueue: Promise<void> = Promise.resolve()

function updateControls(): void {
  const ready = documentPdf !== null && !busy
  pageInput.disabled = zoom.disabled = !ready
  previous.disabled = !ready || pageNumber <= 1
  next.disabled = !ready || pageNumber >= (documentPdf?.numPages ?? 1)
  close.disabled = !loading && !documentPdf
  pin.disabled = !selection || !ready
}
function clearSelection(): void {
  selection = null
  document.getSelection()?.removeAllRanges()
  element("selection").textContent = ""
  element("selection-page").textContent = "尚未选择"
  pin.disabled = true
}
function clearSurface(): void {
  textLayer?.cancel()
  textLayer = null
  textContainer.replaceChildren()
  canvas.width = canvas.height = 0
  surface.style.display = "none"
}
async function dispose(): Promise<void> {
  const oldTask = loading
  loading = null
  documentPdf = null
  rendering?.cancel()
  rendering = null
  clearSurface()
  clearSelection()
  saved = null
  element("saved").hidden = true
  element("saved-text").textContent = ""
  pageNumber = 1
  pageInput.value = "1"
  busy = false
  updateControls()
  if (oldTask) await oldTask.destroy()
}
async function renderCurrent(expectedVersion: number): Promise<void> {
  const pdf = documentPdf
  if (!pdf || expectedVersion !== version) return
  busy = true
  updateControls()
  clearSelection()
  const currentPage = pageNumber
  try {
    const page = await pdf.getPage(currentPage)
    if (expectedVersion !== version) return
    const scale = Number(zoom.value)
    const viewport = page.getViewport({ scale })
    // Bound bitmap allocations independently from document size.
    const ratio = Math.min(window.devicePixelRatio || 1, 2)
    if (viewport.width * viewport.height * ratio * ratio > 16_000_000) {
      throw new Error("PAGE_TOO_LARGE")
    }
    textLayer?.cancel()
    textContainer.replaceChildren()
    surface.style.setProperty("--scale-factor", String(scale))
    surface.style.setProperty("--total-scale-factor", String(scale))
    surface.style.width = viewport.width + "px"
    surface.style.height = viewport.height + "px"
    surface.style.display = "block"
    canvas.width = Math.ceil(viewport.width * ratio)
    canvas.height = Math.ceil(viewport.height * ratio)
    canvas.style.width = viewport.width + "px"
    canvas.style.height = viewport.height + "px"
    const context = canvas.getContext("2d")
    if (!context) throw new Error("CANVAS_UNAVAILABLE")
    rendering = page.render({ canvas, canvasContext: context, viewport, transform: [ratio, 0, 0, ratio, 0, 0] })
    await rendering.promise
    if (expectedVersion !== version) return
    const content = await page.getTextContent()
    if (expectedVersion !== version) return
    textLayer = new TextLayer({ textContentSource: content, container: textContainer, viewport })
    await textLayer.render()
    if (expectedVersion !== version) return
    const hasText = content.items.some(item => "str" in item && item.str.trim().length > 0)
    pageInput.value = String(currentPage)
    pageInput.max = String(pdf.numPages)
    status.textContent = "第 " + currentPage + " / " + pdf.numPages + " 页" +
      (hasText ? " · 可选择文字" : " · 此页无可提取文字，暂不支持扫描件 OCR")
    surface.dataset.page = String(currentPage)
  } catch (error: unknown) {
    if (expectedVersion !== version) return
    clearSurface()
    status.textContent = error instanceof Error && error.message === "PAGE_TOO_LARGE"
      ? "此页尺寸超出验证范围，请缩小显示比例或更换文档"
      : "页面显示失败，请更换文档"
  } finally {
    if (expectedVersion === version) {
      busy = false
      updateControls()
    }
  }
}
function scheduleRender(): void {
  const expectedVersion = version
  busy = true
  updateControls()
  renderQueue = renderQueue.then(() => renderCurrent(expectedVersion))
}
async function openFile(file: File): Promise<void> {
  const expectedVersion = ++version
  try {
    await dispose()
    if (expectedVersion !== version) return
    if (file.size > 20 * 1024 * 1024) {
      status.textContent = "文件超过 20 MB 验证上限"
      return
    }
    status.textContent = "正在本地读取…"
    const bytes = new Uint8Array(await file.arrayBuffer())
    if (expectedVersion !== version) return
    if (new TextDecoder().decode(bytes.subarray(0, 1024)).indexOf("%PDF-") < 0) {
      status.textContent = "文件不是有效 PDF"
      return
    }
    const task = getDocument({
      data: bytes,
      cMapUrl: "/pdf-assets/cmaps/", cMapPacked: true,
      standardFontDataUrl: "/pdf-assets/standard_fonts/",
      wasmUrl: "/pdf-assets/wasm/",
      useSystemFonts: false
    })
    loading = task
    busy = true
    updateControls()
    const pdf = await task.promise
    if (expectedVersion !== version) return
    if (pdf.numPages > 120) {
      await dispose()
      if (expectedVersion === version) status.textContent = "文档超过 120 页验证上限"
      return
    }
    documentPdf = pdf
    pageNumber = 1
    zoom.value = "1"
    scheduleRender()
  } catch (error: unknown) {
    if (expectedVersion !== version) return
    const encrypted = error instanceof Error && error.name === "PasswordException"
    await dispose()
    if (expectedVersion === version) {
      status.textContent = encrypted ? "加密 PDF 暂不支持，请选择未加密的副本" : "PDF 无法读取，文件可能损坏"
    }
  }
}
fileInput.addEventListener("change", () => {
  const file = fileInput.files?.[0]
  if (file) void openFile(file)
})
close.addEventListener("click", () => {
  const expectedVersion = ++version
  void dispose().then(() => {
    if (version !== expectedVersion) return
    fileInput.value = ""
    status.textContent = "文档已关闭，片段已清除"
  }).catch(() => { status.textContent = "文档资源清理失败，请刷新验证页" })
})
previous.addEventListener("click", () => { if (!busy && pageNumber > 1) { pageNumber--; scheduleRender() } })
next.addEventListener("click", () => {
  if (!busy && documentPdf && pageNumber < documentPdf.numPages) { pageNumber++; scheduleRender() }
})
pageInput.addEventListener("change", () => {
  const requested = Number(pageInput.value)
  if (documentPdf && Number.isInteger(requested) && requested >= 1 && requested <= documentPdf.numPages) {
    pageNumber = requested
    scheduleRender()
  } else pageInput.value = String(pageNumber)
})
zoom.addEventListener("change", scheduleRender)
function captureSelection(): void {
  if (busy || !documentPdf) return
  const current = document.getSelection()
  if (!current || current.isCollapsed || !textContainer.contains(current.anchorNode) || !textContainer.contains(current.focusNode)) return
  const text = Array.from(current.toString().trim()).slice(0, 1500).join("")
  selection = text ? { page: pageNumber, text } : null
  element("selection").textContent = text
  element("selection-page").textContent = selection ? "来源：第 " + pageNumber + " 页" : "尚未选择"
  updateControls()
}
textContainer.addEventListener("pointerup", captureSelection)
document.addEventListener("keyup", captureSelection)
pin.addEventListener("click", () => {
  if (!selection) return
  saved = { ...selection }
  element("saved-page").textContent = "来源：第 " + saved.page + " 页"
  element("saved-text").textContent = saved.text
  element("saved").hidden = false
})
element("return").addEventListener("click", () => {
  if (!saved || !documentPdf || busy) return
  pageNumber = saved.page
  scheduleRender()
})
