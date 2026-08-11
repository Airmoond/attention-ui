import { describe, expect, it } from "vitest"
import { createSafeLogger, MAX_LOG_ENTRIES } from "./logger"

describe("safe logger", () => {
  it("keeps only the newest one hundred entries", () => {
    let timestamp = 0
    const logger = createSafeLogger({ now: () => ++timestamp })
    for (let index = 0; index <= MAX_LOG_ENTRIES; index += 1) {
      logger.info(`EVENT_${index}`, `message ${index}`)
    }

    const logs = logger.getLogs()
    expect(logs).toHaveLength(100)
    expect(logs[0]?.event).toBe("EVENT_1")
    expect(logs.at(-1)?.event).toBe("EVENT_100")
  })

  it("keeps allowlisted metadata and removes sensitive or content fields", () => {
    const logger = createSafeLogger({ now: () => 1234 })
    logger.error("AI_REQUEST_FAILED", "AI request failed safely", {
      toolId: "summarize",
      durationMs: 25,
      errorCode: "AI_AUTH_FAILED",
      apiKey: "secret-api-key",
      authorization: "Bearer secret",
      clientToken: "secret-client-token",
      pairingToken: "FUI-SECRET-TOKEN",
      text: "full page text",
      selectedText: "selected page text",
      question: "private question",
      response: "full AI response",
      url: "https://private.example/history"
    })

    expect(logger.getLogs()[0]?.metadata).toEqual({
      toolId: "summarize",
      durationMs: 25,
      errorCode: "AI_AUTH_FAILED"
    })
    expect(JSON.stringify(logger.getLogs())).not.toMatch(
      /secret|full page|selected page|private question|private\.example/u
    )
  })

  it("clears all entries", () => {
    const logger = createSafeLogger()
    logger.info("SERVICE_STARTED", "service started")
    logger.clear()
    expect(logger.getLogs()).toEqual([])
  })

  it("never throws when logging itself fails", () => {
    const logger = createSafeLogger({
      now: () => {
        throw new Error("clock unavailable")
      }
    })
    expect(() => logger.error("FAILURE", "safe message")).not.toThrow()
    expect(logger.getLogs()).toEqual([])
  })
})
