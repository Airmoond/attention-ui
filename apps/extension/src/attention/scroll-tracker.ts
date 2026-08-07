export type ScrollState = {
  lastScrollAt: number
  isScrolling: boolean
}

export const SCROLL_IDLE_DELAY_MS = 500

export class ScrollTracker {
  private state: ScrollState = { lastScrollAt: 0, isScrolling: false }
  private idleTimeout: ReturnType<typeof globalThis.setTimeout> | null = null
  private started = false
  private readonly subscribers = new Set<(state: ScrollState) => void>()

  public constructor(
    private readonly idleDelayMs = SCROLL_IDLE_DELAY_MS,
    private readonly now: () => number = () => performance.now()
  ) {}

  public start(): void {
    if (this.started) {
      return
    }

    window.addEventListener("scroll", this.handleScroll, { passive: true })
    this.started = true
  }

  public stop(): void {
    if (!this.started) {
      return
    }

    window.removeEventListener("scroll", this.handleScroll)
    this.clearIdleTimeout()
    this.started = false
    this.state = { lastScrollAt: 0, isScrolling: false }
  }

  public getSnapshot(): ScrollState {
    return { ...this.state }
  }

  public subscribe(callback: (state: ScrollState) => void): () => void {
    this.subscribers.add(callback)
    return () => this.subscribers.delete(callback)
  }

  private readonly handleScroll = (): void => {
    this.state = { lastScrollAt: this.now(), isScrolling: true }
    this.notify()
    this.clearIdleTimeout()
    this.idleTimeout = globalThis.setTimeout(() => {
      this.state = { ...this.state, isScrolling: false }
      this.idleTimeout = null
      this.notify()
    }, this.idleDelayMs)
  }

  private clearIdleTimeout(): void {
    if (this.idleTimeout !== null) {
      globalThis.clearTimeout(this.idleTimeout)
      this.idleTimeout = null
    }
  }

  private notify(): void {
    for (const subscriber of this.subscribers) {
      subscriber(this.getSnapshot())
    }
  }
}
