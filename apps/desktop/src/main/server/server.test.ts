import { afterEach, describe, expect, it } from "vitest"
import {
  AppSettingsSchema,
  DEFAULT_APP_SETTINGS,
  type ApiError,
  type AuthState,
  type PageContext,
  type PairResponse
} from "@focus-ui/shared"
import { createServer, type Server } from "node:http"
import { createAuthController } from "./auth"
import { createAiPlanner } from "../ai/ai-planner"
import { createOpenAiCompatibleProvider } from "../ai/ai-provider"
import { createToolExecutor } from "../ai/tool-executor"
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
    const provider = createOpenAiCompatibleProvider({
      getSettings: () => ({
        ...DEFAULT_APP_SETTINGS,
        apiBaseUrl: "https://api.example.test/v1",
        apiKey: "desktop-only-key",
        modelName: "focus-model"
      }),
      fetchImplementation: async (_input, init) => {
        const requestBody = JSON.parse(String(init?.body)) as {
          messages: Array<{ role: string; content: string }>
        }
        const systemPrompt = requestBody.messages[0]?.content ?? ""
        const userPrompt = requestBody.messages[1]?.content ?? ""
        let content = "当前内容的简洁结果"
        if (systemPrompt.includes("单次工具规划器")) {
          const context = JSON.parse(userPrompt) as PageContext
          content = JSON.stringify({
            toolId:
              context.contextKind === "numbers"
                ? "chart"
                : context.contextKind === "code"
                  ? "explain"
                  : "summarize",
            reason: "根据当前内容类型选择",
            confidence: 0.9
          })
        } else if (systemPrompt.includes("图表数据")) {
          content = JSON.stringify({
            title: "年度营收",
            labels: ["2024", "2025"],
            values: [100, 120],
            unit: "亿元"
          })
        }
        return Response.json({ choices: [{ message: { content } }] })
      }
    })
    const planner = createAiPlanner({ provider })
    const executor = createToolExecutor(provider)
    configureLocalServer({
      getAiConfigured: (): boolean => true,
      authController,
      planPageContext: planner.plan,
      executeTool: executor.execute
    })
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

    const headers = {
      Authorization: `Bearer ${pairResult.clientToken}`,
      "Content-Type": "application/json"
    }
    const contextFor = (contextKind: PageContext["contextKind"]): PageContext => ({
      url: "https://example.test",
      pageTitle: "Example",
      text:
        contextKind === "numbers"
          ? "2024年营收100亿元，2025年营收120亿元。"
          : "当前关注内容包含足够的信息用于规划工具。",
      selectedText: null,
      nearbyHeading: null,
      contextKind,
      numericCandidates:
        contextKind === "numbers"
          ? [
              { label: "年份", rawValue: "2024", value: 2024 },
              { label: "营收", rawValue: "100", value: 100 },
              { label: "年份", rawValue: "2025", value: 2025 },
              { label: "营收", rawValue: "120", value: 120 }
            ]
          : []
    })

    for (const [contextKind, toolId] of [
      ["numbers", "chart"],
      ["text", "summarize"],
      ["code", "explain"]
    ] as const) {
      const response = await fetch("http://127.0.0.1:17321/v1/plan", {
        method: "POST",
        headers,
        body: JSON.stringify({ pageContext: contextFor(contextKind) })
      })
      expect(response.status).toBe(200)
      await expect(response.json()).resolves.toMatchObject({
        source: "ai",
        plan: { toolId }
      })
    }

    const chartResponse = await fetch("http://127.0.0.1:17321/v1/execute", {
      method: "POST",
      headers,
      body: JSON.stringify({ toolId: "chart", pageContext: contextFor("numbers") })
    })
    expect(chartResponse.status).toBe(200)
    await expect(chartResponse.json()).resolves.toMatchObject({
      toolId: "chart",
      success: true,
      data: { labels: ["2024", "2025"], values: [100, 120] }
    })

    const illegalToolResponse = await fetch("http://127.0.0.1:17321/v1/execute", {
      method: "POST",
      headers,
      body: JSON.stringify({ toolId: "run-script", pageContext: contextFor("text") })
    })
    expect(illegalToolResponse.status).toBe(400)

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
