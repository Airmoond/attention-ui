export type PointerSnapshot = {
  x: number
  y: number
  timestamp: number
  speedPxPerMs: number
}

export const POINTER_SAMPLE_INTERVAL_MS = 50

export const createPointerSnapshot = (
  previous: PointerSnapshot | null,
  x: number,
  y: number,
  timestamp: number
): PointerSnapshot => {
  if (!previous) {
    return { x, y, timestamp, speedPxPerMs: 0 }
  }

  const elapsed = timestamp - previous.timestamp
  if (elapsed <= 0) {
    return { x, y, timestamp, speedPxPerMs: 0 }
  }

  return {
    x,
    y,
    timestamp,
    speedPxPerMs: Math.hypot(x - previous.x, y - previous.y) / elapsed
  }
}

export class PointerTracker {
  private snapshot: PointerSnapshot | null = null
  private started = false
  private readonly subscribers = new Set<(snapshot: PointerSnapshot) => void>()

  public constructor(
    private readonly sampleIntervalMs = POINTER_SAMPLE_INTERVAL_MS,
    private readonly now: () => number = () => performance.now()
  ) {}

  public start(): void {
    if (this.started) {
      return
    }

    document.addEventListener("pointermove", this.handlePointerMove, { passive: true })
    this.started = true
  }

  public stop(): void {
    if (!this.started) {
      return
    }

    document.removeEventListener("pointermove", this.handlePointerMove)
    this.started = false
    this.snapshot = null
  }

  public getSnapshot(): PointerSnapshot | null {
    if (!this.snapshot) {
      return null
    }

    return {
      ...this.snapshot,
      speedPxPerMs:
        this.now() - this.snapshot.timestamp >= this.sampleIntervalMs ? 0 : this.snapshot.speedPxPerMs
    }
  }

  public subscribe(callback: (snapshot: PointerSnapshot) => void): () => void {
    this.subscribers.add(callback)
    return () => this.subscribers.delete(callback)
  }

  private readonly handlePointerMove = (event: PointerEvent): void => {
    const timestamp = this.now()
    if (this.snapshot && timestamp - this.snapshot.timestamp < this.sampleIntervalMs) {
      return
    }

    this.snapshot = createPointerSnapshot(this.snapshot, event.clientX, event.clientY, timestamp)
    for (const subscriber of this.subscribers) {
      subscriber(this.snapshot)
    }
  }
}
