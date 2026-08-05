import { afterEach, describe, expect, it } from "vitest"
import { AppSettingsSchema, DEFAULT_APP_SETTINGS } from "@focus-ui/shared"
import { getLocalServiceStatus, startLocalServer, stopLocalServer } from "./server"

const healthAddress = "http://127.0.0.1:17321/health"

afterEach(async () => {
  await stopLocalServer()
})

describe("local desktop service", () => {
  it("serves health, prevents duplicate starts, and releases its port", async () => {
    const started = await startLocalServer()
    expect(started).toMatchObject({ state: "running", running: true })

    const repeatedStart = await startLocalServer()
    expect(repeatedStart).toMatchObject({ state: "running", running: true })

    const healthResponse = await fetch(healthAddress)
    expect(healthResponse.status).toBe(200)
    await expect(healthResponse.json()).resolves.toEqual({
      ok: true,
      service: "focusui-desktop",
      version: "0.1.0",
      aiConfigured: false
    })

    const stopped = await stopLocalServer()
    expect(stopped).toMatchObject({ state: "stopped", running: false })
    expect(getLocalServiceStatus().running).toBe(false)
    await expect(fetch(healthAddress)).rejects.toThrow()
  })
})

describe("application settings schema", () => {
  it("accepts defaults and rejects invalid delay and boolean values", () => {
    expect(AppSettingsSchema.safeParse(DEFAULT_APP_SETTINGS).success).toBe(true)
    expect(
      AppSettingsSchema.safeParse({ ...DEFAULT_APP_SETTINGS, attentionDelayMs: 299 }).success
    ).toBe(false)
    expect(
      AppSettingsSchema.safeParse({ ...DEFAULT_APP_SETTINGS, attentionDelayMs: 3001 }).success
    ).toBe(false)
    expect(
      AppSettingsSchema.safeParse({ ...DEFAULT_APP_SETTINGS, enableAI: "true" }).success
    ).toBe(false)
  })
})
