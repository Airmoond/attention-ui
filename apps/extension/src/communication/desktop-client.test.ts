import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  clearPreferenceCache,
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
