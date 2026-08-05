import { afterEach, describe, expect, it } from "vitest"
import {
  AppSettingsSchema,
  DEFAULT_APP_SETTINGS,
  type ApiError,
  type AuthState,
  type PairResponse
} from "@focus-ui/shared"
import { createServer, type Server } from "node:http"
import { createAuthController } from "./auth"
import {
  configureLocalServer,
  getLocalServiceStatus,
  startLocalServer,
  stopLocalServer
} from "./server"

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

describe("pairing and protected local API", () => {
  it("enforces pairing, bearer authentication, token invalidation, and strict CORS", async () => {
    let authState: AuthState = {
      pairingToken: "FUI-TEST-1234",
      clientToken: null,
      tokenVersion: 0,
      lastConnectedAt: null
    }
    const authController = createAuthController({
      getState: (): AuthState => authState,
      setState: (nextState: AuthState): void => {
        authState = nextState
      }
    })
    configureLocalServer({ getAiConfigured: (): boolean => false, authController })
    await startLocalServer()

    const wrongPairResponse = await fetch("http://127.0.0.1:17321/v1/pair", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pairingToken: "WRONG-TOKEN" })
    })
    expect(wrongPairResponse.status).toBe(401)
    await expect(wrongPairResponse.json()).resolves.toMatchObject({
      ok: false,
      code: "INVALID_PAIRING_TOKEN",
      message: "配对令牌无效"
    } satisfies ApiError)

    const pairResponse = await fetch("http://127.0.0.1:17321/v1/pair", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pairingToken: authState.pairingToken })
    })
    expect(pairResponse.status).toBe(200)
    const pairResult = (await pairResponse.json()) as PairResponse
    expect(pairResult.ok).toBe(true)
    expect(pairResult.clientToken.length).toBeGreaterThan(40)

    const missingAuthorizationResponse = await fetch("http://127.0.0.1:17321/v1/auth-check")
    expect(missingAuthorizationResponse.status).toBe(401)
    const invalidAuthorizationResponse = await fetch("http://127.0.0.1:17321/v1/auth-check", {
      headers: { Authorization: "Bearer invalid-token" }
    })
    expect(invalidAuthorizationResponse.status).toBe(401)
    const authenticatedResponse = await fetch("http://127.0.0.1:17321/v1/auth-check", {
      headers: { Authorization: `Bearer ${pairResult.clientToken}` }
    })
    expect(authenticatedResponse.status).toBe(200)
    await expect(authenticatedResponse.json()).resolves.toEqual({ ok: true, authenticated: true })
    expect(authState.lastConnectedAt).not.toBeNull()

    const nextPairingStatus = authController.regeneratePairingToken()
    expect(nextPairingStatus.paired).toBe(false)
    const expiredTokenResponse = await fetch("http://127.0.0.1:17321/v1/auth-check", {
      headers: { Authorization: `Bearer ${pairResult.clientToken}` }
    })
    expect(expiredTokenResponse.status).toBe(401)

    const replacementPairResponse = await fetch("http://127.0.0.1:17321/v1/pair", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pairingToken: nextPairingStatus.pairingToken })
    })
    const replacementPairResult = (await replacementPairResponse.json()) as PairResponse
    authController.disconnectPlugin()
    const disconnectedTokenResponse = await fetch("http://127.0.0.1:17321/v1/auth-check", {
      headers: { Authorization: `Bearer ${replacementPairResult.clientToken}` }
    })
    expect(disconnectedTokenResponse.status).toBe(401)

    const disallowedOriginResponse = await fetch(healthAddress, {
      headers: { Origin: "https://untrusted.example" }
    })
    expect(disallowedOriginResponse.status).toBe(403)
    const extensionOrigin = "chrome-extension://abcdefghijklmnopqrstuvwxzy123456"
    const extensionOriginResponse = await fetch(healthAddress, { headers: { Origin: extensionOrigin } })
    expect(extensionOriginResponse.status).toBe(200)
    expect(extensionOriginResponse.headers.get("access-control-allow-origin")).toBe(extensionOrigin)
  })
})
