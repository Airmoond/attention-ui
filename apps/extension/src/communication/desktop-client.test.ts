import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  clearPreferenceCache,
  executeDesktopTool,
  EXECUTE_REQUEST_TIMEOUT_MS,
  getDesktopPreferences,
  PREFERENCE_CACHE_TTL_MS,
  recordDesktopToolEvent
} from "./desktop-client"

vi.mock("../storage/extension-store", () => ({
  getExtensionSettings: vi.fn().mockResolvedValue({
    desktopBaseUrl: "http://127.0.0.1:17321",
    clientToken: "authenticated-client-token-value",
    enabled: true
  })
}))

const preferencesResponse = {
  ok: true as const,
  preferences: {
    globalToolCount: { chart: 3 },
    contextToolCount: { numbers: { chart: 3 } },
    lastUsedAt: { chart: 1234 },
    pinnedTools: []
  }
}

beforeEach(() => {
  clearPreferenceCache()
  vi.restoreAllMocks()
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe("desktop preference cache", () => {
  it("caches successful preference reads for ten seconds", async () => {
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json(preferencesResponse))
    vi.stubGlobal("fetch", fetchImplementation)

    await expect(getDesktopPreferences()).resolves.toMatchObject({ ok: true })
    await expect(getDesktopPreferences()).resolves.toMatchObject({ ok: true })

    expect(PREFERENCE_CACHE_TTL_MS).toBe(10_000)
    expect(fetchImplementation).toHaveBeenCalledOnce()
  })

  it("invalidates the cache after a tool event is recorded", async () => {
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json(preferencesResponse))
      .mockResolvedValueOnce(Response.json({ ok: true }))
      .mockResolvedValueOnce(Response.json(preferencesResponse))
    vi.stubGlobal("fetch", fetchImplementation)

    await getDesktopPreferences()
    await recordDesktopToolEvent({
      eventType: "tool_clicked",
      contextType: "numbers",
      toolId: "chart"
    })
    await getDesktopPreferences()

    expect(fetchImplementation).toHaveBeenCalledTimes(3)
  })
})

describe("desktop tool transport", () => {
  const executeRequest = {
    toolId: "summarize" as const,
    pageContext: {
      url: "http://localhost:8080/article.html",
      pageTitle: "Article",
      text: "This is a sufficiently long paragraph for the summary tool.",
      selectedText: null,
      nearbyHeading: "Overview",
      contextKind: "text" as const,
      numericCandidates: []
    }
  }

  it("classifies an execution transport timeout as an AI timeout", async () => {
    vi.useFakeTimers()
    const fetchImplementation = vi.fn<typeof fetch>().mockImplementation(
      async (_input, init): Promise<Response> =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("aborted", "AbortError"))
          })
        })
    )
    vi.stubGlobal("fetch", fetchImplementation)

    const pendingResult = executeDesktopTool(executeRequest)
    await vi.advanceTimersByTimeAsync(EXECUTE_REQUEST_TIMEOUT_MS)

    await expect(pendingResult).resolves.toMatchObject({
      ok: false,
      error: { code: "AI_REQUEST_TIMEOUT" }
    })
  })

  it("does not report the desktop offline when a follow-up health check succeeds", async () => {
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(new TypeError("request failed"))
      .mockResolvedValueOnce(
        Response.json({
          ok: true,
          service: "attentionui-desktop",
          version: "0.1.0",
          aiConfigured: true
        })
      )
    vi.stubGlobal("fetch", fetchImplementation)

    await expect(executeDesktopTool(executeRequest)).resolves.toMatchObject({
      ok: false,
      error: { code: "DESKTOP_REQUEST_FAILED" }
    })
    expect(fetchImplementation).toHaveBeenCalledTimes(2)
  })
})
