import { afterEach, describe, expect, it } from "vitest"
import { AppSettingsSchema, DEFAULT_APP_SETTINGS } from "@focus-ui/shared"
import { createServer, type Server } from "node:http"
import { getLocalServiceStatus, startLocalServer, stopLocalServer } from "./server"

const healthAddress = "http://127.0.0.1:17321/health"

const listenOnLocalServicePort = async (server: Server): Promise<void> => {
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject)
    server.listen(17321, "127.0.0.1", () => {
      server.off("error", reject)
      resolve()
    })
  })
}

const closeServer = async (server: Server): Promise<void> => {
  await new Promise<void>((resolve, reject) => {
    server.close((error?: Error) => {
      if (error) {
        reject(error)
        return
      }
      resolve()
    })
  })
}

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

  it("reports a clear error when the local service port is already in use", async () => {
    const occupiedServer = createServer()
    await listenOnLocalServicePort(occupiedServer)

    try {
      const status = await startLocalServer()
      expect(status).toMatchObject({ state: "error", running: false })
      expect(status.error).toBe("端口 17321 已被占用。")
    } finally {
      await closeServer(occupiedServer)
    }
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
