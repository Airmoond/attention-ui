import type { LogEntry, LogLevel, LogMetadata } from "@attention-ui/shared"

export const MAX_LOG_ENTRIES = 100

const ALLOWED_METADATA_KEYS = new Set([
  "toolId",
  "contextKind",
  "durationMs",
  "statusCode",
  "errorCode",
  "providerStatus",
  "cacheHit",
  "source"
])

type UnsafeMetadata = Record<string, unknown>

export type WriteLogInput = {
  level: LogLevel
  event: string
  message: string
  metadata?: UnsafeMetadata
}

export type SafeLogger = {
  log: (input: WriteLogInput) => void
  info: (event: string, message: string, metadata?: UnsafeMetadata) => void
  warning: (event: string, message: string, metadata?: UnsafeMetadata) => void
  error: (event: string, message: string, metadata?: UnsafeMetadata) => void
  getLogs: () => LogEntry[]
  clear: () => void
}

const sanitizeMetadata = (metadata: UnsafeMetadata | undefined): LogMetadata | undefined => {
  if (!metadata) {
    return undefined
  }

  const safeMetadata: LogMetadata = {}
  for (const [key, value] of Object.entries(metadata)) {
    if (
      ALLOWED_METADATA_KEYS.has(key) &&
      (typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean" ||
        value === null)
    ) {
      safeMetadata[key] = value
    }
  }
  return Object.keys(safeMetadata).length > 0 ? safeMetadata : undefined
}

export const createSafeLogger = (
  options: { now?: () => number; maximumEntries?: number } = {}
): SafeLogger => {
  const now = options.now ?? Date.now
  const maximumEntries = Math.max(1, options.maximumEntries ?? MAX_LOG_ENTRIES)
  const entries: LogEntry[] = []
  let sequence = 0

  const log = (input: WriteLogInput): void => {
    try {
      const timestamp = now()
      sequence += 1
      const metadata = sanitizeMetadata(input.metadata)
      entries.push({
        id: `${timestamp}-${sequence}`,
        level: input.level,
        event: input.event.slice(0, 100),
        message: input.message.slice(0, 300),
        timestamp,
        ...(metadata ? { metadata } : {})
      })
      if (entries.length > maximumEntries) {
        entries.splice(0, entries.length - maximumEntries)
      }
    } catch (_error: unknown) {
      // Logging is deliberately non-critical and must never break the application.
    }
  }

  return {
    log,
    info: (event, message, metadata): void => log({ level: "info", event, message, metadata }),
    warning: (event, message, metadata): void =>
      log({ level: "warning", event, message, metadata }),
    error: (event, message, metadata): void =>
      log({ level: "error", event, message, metadata }),
    getLogs: (): LogEntry[] => entries.map((entry) => ({
      ...entry,
      ...(entry.metadata ? { metadata: { ...entry.metadata } } : {})
    })),
    clear: (): void => {
      entries.length = 0
    }
  }
}

export const appLogger = createSafeLogger()
