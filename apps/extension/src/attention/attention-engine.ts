import {
  PointerTracker,
  type PointerSnapshot
} from "./pointer-tracker"
import { SCROLL_IDLE_DELAY_MS, ScrollTracker, type ScrollState } from "./scroll-tracker"
import { SelectionTracker } from "./selection-tracker"
import {
  resolveSemanticBlockAtPoint,
  SemanticBlockDebugOutline,
  type SemanticBlock,
  type SemanticBlockKind
} from "../context/semantic-block"

export type AttentionCandidate = {
  element: HTMLElement
  rect: DOMRect
  text: string
  kind: SemanticBlockKind
  pointerX: number
  pointerY: number
  triggeredAt: number
}

export type AttentionState = {
  currentElement: HTMLElement | null
  currentBlock: SemanticBlock | null
  enteredAt: number
  lastPointerAt: number
  pointerSpeed: number
  lastScrollAt: number
  triggeredElement: HTMLElement | null
}

export const ATTENTION_DELAY_MS = 900
export const MAX_ATTENTION_SPEED_PX_PER_MS = 0.25
export const MIN_VISIBLE_RATIO = 0.6
export const ATTENTION_COOLDOWN_MS = 30_000
const ENGINE_TICK_MS = 100

const triggerTimes = new WeakMap<HTMLElement, number>()

export const isCoolingDown = (lastTriggeredAt: number | undefined, now: number): boolean =>
  lastTriggeredAt !== undefined && now - lastTriggeredAt < ATTENTION_COOLDOWN_MS

const getVisibleRatio = (rect: DOMRect): number => {
  const visibleWidth = Math.max(0, Math.min(rect.right, window.innerWidth) - Math.max(rect.left, 0))
  const visibleHeight = Math.max(0, Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0))
  const totalArea = rect.width * rect.height
  return totalArea > 0 ? (visibleWidth * visibleHeight) / totalArea : 0
}

export type AttentionEngineOptions = {
  onAttentionCandidate: (candidate: AttentionCandidate) => void
  attentionDelayMs?: number
  pointerTracker?: PointerTracker
  scrollTracker?: ScrollTracker
  selectionTracker?: SelectionTracker
  debugOutline?: SemanticBlockDebugOutline
  now?: () => number
}

export class AttentionEngine {
  private readonly pointerTracker: PointerTracker
  private readonly scrollTracker: ScrollTracker
  private readonly selectionTracker: SelectionTracker
  private readonly attentionDelayMs: number
  private readonly now: () => number
  private state: AttentionState = {
    currentElement: null,
    currentBlock: null,
    enteredAt: 0,
    lastPointerAt: 0,
    pointerSpeed: 0,
    lastScrollAt: 0,
    triggeredElement: null
  }
  private visibleRatio = 0
  private observer: IntersectionObserver | null = null
  private tickTimer: ReturnType<typeof globalThis.setInterval> | null = null
  private unsubscribePointer: (() => void) | null = null
  private unsubscribeScroll: (() => void) | null = null
  private started = false

  public constructor(private readonly options: AttentionEngineOptions) {
    this.pointerTracker = options.pointerTracker ?? new PointerTracker()
    this.scrollTracker = options.scrollTracker ?? new ScrollTracker()
    this.selectionTracker = options.selectionTracker ?? new SelectionTracker()
    this.attentionDelayMs = options.attentionDelayMs ?? ATTENTION_DELAY_MS
    this.now = options.now ?? (() => performance.now())
  }

  public start(): void {
    if (this.started) {
      return
    }

    this.pointerTracker.start()
    this.scrollTracker.start()
    this.selectionTracker.start()
    this.unsubscribePointer = this.pointerTracker.subscribe(this.handlePointerSnapshot)
    this.unsubscribeScroll = this.scrollTracker.subscribe(this.handleScrollState)
    document.addEventListener("visibilitychange", this.handleVisibilityChange)
    this.tickTimer = globalThis.setInterval(this.evaluateAttention, ENGINE_TICK_MS)
    this.started = true
  }

  public stop(): void {
    if (!this.started) {
      return
    }

    this.unsubscribePointer?.()
    this.unsubscribePointer = null
    this.unsubscribeScroll?.()
    this.unsubscribeScroll = null
    this.pointerTracker.stop()
    this.scrollTracker.stop()
    this.selectionTracker.stop()
    document.removeEventListener("visibilitychange", this.handleVisibilityChange)
    if (this.tickTimer !== null) {
      globalThis.clearInterval(this.tickTimer)
      this.tickTimer = null
    }
    this.disconnectObserver()
    this.options.debugOutline?.clear()
    this.state = {
      currentElement: null,
      currentBlock: null,
      enteredAt: 0,
      lastPointerAt: 0,
      pointerSpeed: 0,
      lastScrollAt: 0,
      triggeredElement: null
    }
    this.visibleRatio = 0
    this.started = false
  }

  public getState(): AttentionState {
    return { ...this.state }
  }

  private readonly handlePointerSnapshot = (snapshot: PointerSnapshot): void => {
    this.state.lastPointerAt = snapshot.timestamp
    this.state.pointerSpeed = snapshot.speedPxPerMs
    if (document.visibilityState !== "visible" || this.scrollTracker.getSnapshot().isScrolling) {
      this.clearCurrentBlock()
      return
    }

    if (snapshot.speedPxPerMs > MAX_ATTENTION_SPEED_PX_PER_MS) {
      this.clearCurrentBlock()
      return
    }

    const block = resolveSemanticBlockAtPoint(snapshot.x, snapshot.y)
    if (!block) {
      this.clearCurrentBlock()
      return
    }

    if (this.state.currentElement !== block.element) {
      this.setCurrentBlock(block, snapshot.timestamp)
    }
  }

  private readonly handleScrollState = (scrollState: ScrollState): void => {
    this.state.lastScrollAt = scrollState.lastScrollAt
    if (scrollState.isScrolling) {
      this.clearCurrentBlock()
    }
  }

  private readonly handleVisibilityChange = (): void => {
    if (document.visibilityState !== "visible") {
      this.clearCurrentBlock()
    }
  }

  private readonly evaluateAttention = (): void => {
    const pointer = this.pointerTracker.getSnapshot()
    const scroll = this.scrollTracker.getSnapshot()
    const now = this.now()
    if (!pointer || document.visibilityState !== "visible") {
      return
    }

    this.state.pointerSpeed = pointer.speedPxPerMs
    if (this.state.currentBlock === null) {
      if (
        !scroll.isScrolling &&
        now - scroll.lastScrollAt >= SCROLL_IDLE_DELAY_MS &&
        pointer.speedPxPerMs <= MAX_ATTENTION_SPEED_PX_PER_MS
      ) {
        const block = resolveSemanticBlockAtPoint(pointer.x, pointer.y)
        if (block) {
          this.setCurrentBlock(block, now)
        }
      }
      return
    }

    const block = this.state.currentBlock
    if (
      scroll.isScrolling ||
      now - scroll.lastScrollAt < SCROLL_IDLE_DELAY_MS ||
      pointer.speedPxPerMs > MAX_ATTENTION_SPEED_PX_PER_MS ||
      this.visibleRatio < MIN_VISIBLE_RATIO ||
      now - this.state.enteredAt < this.attentionDelayMs
    ) {
      return
    }

    if (this.state.triggeredElement === block.element || isCoolingDown(triggerTimes.get(block.element), now)) {
      return
    }

    triggerTimes.set(block.element, now)
    this.state.triggeredElement = block.element
    this.options.onAttentionCandidate({
      element: block.element,
      rect: block.element.getBoundingClientRect(),
      text: block.text,
      kind: block.kind,
      pointerX: pointer.x,
      pointerY: pointer.y,
      triggeredAt: now
    })
  }

  private setCurrentBlock(block: SemanticBlock, enteredAt: number): void {
    this.disconnectObserver()
    this.state.currentElement = block.element
    this.state.currentBlock = block
    this.state.enteredAt = enteredAt
    this.state.triggeredElement = null
    this.visibleRatio = getVisibleRatio(block.rect)
    this.options.debugOutline?.show(block)

    this.observer = new IntersectionObserver(this.handleIntersection, {
      threshold: [0, MIN_VISIBLE_RATIO, 1]
    })
    this.observer.observe(block.element)
  }

  private readonly handleIntersection = (entries: IntersectionObserverEntry[]): void => {
    const currentElement = this.state.currentElement
    const entry = entries.find((item) => item.target === currentElement)
    if (!entry) {
      return
    }

    this.visibleRatio = entry.intersectionRatio
    if (!entry.isIntersecting || this.visibleRatio < MIN_VISIBLE_RATIO) {
      this.clearCurrentBlock()
    }
  }

  private clearCurrentBlock(): void {
    this.disconnectObserver()
    this.options.debugOutline?.clear()
    this.state.currentElement = null
    this.state.currentBlock = null
    this.state.enteredAt = 0
    this.state.triggeredElement = null
    this.visibleRatio = 0
  }

  private disconnectObserver(): void {
    this.observer?.disconnect()
    this.observer = null
  }
}
