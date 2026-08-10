import { DEFAULT_APP_SETTINGS, type AppSettings } from "@focus-ui/shared"
import { describe, expect, it, vi } from "vitest"
import {
  createOpenAiCompatibleProvider,
  resolveChatCompletionsUrl
} from "./ai-provider"

const configuredSettings = (update: Partial<AppSettings> = {}): AppSettings => ({
  ...DEFAULT_APP_SETTINGS,
  apiBaseUrl: "https://api.example.test/v1",
  apiKey: "desktop-only-key",
  modelName: "focus-model",
  ...update
})

describe("OpenAI compatible provider", () => {
  it("requires all Desktop AI settings", async () => {
    const provider = createOpenAiCompatibleProvider({
      getSettings: () => configuredSettings({ apiKey: "" })
    })

    await expect(
      provider.complete({ systemPrompt: "system", userPrompt: "user" })
    ).rejects.toMatchObject({ code: "AI_NOT_CONFIGURED" })
  })

  it("classifies an invalid API key without exposing the response body", async () => {
    const fetchImplementation = vi.fn<typeof fetch>().mockResolvedValue(
      new Response("secret provider detail", { status: 401 })
    )
    const provider = createOpenAiCompatibleProvider({
      getSettings: configuredSettings,
      fetchImplementation
    })

    await expect(
      provider.complete({ systemPrompt: "system", userPrompt: "private page text" })
    ).rejects.toMatchObject({ code: "AI_AUTH_FAILED", message: "AI_AUTH_FAILED" })
  })

  it("classifies network failures", async () => {
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockRejectedValue(new TypeError("network unavailable"))
    const provider = createOpenAiCompatibleProvider({
      getSettings: configuredSettings,
      fetchImplementation
    })

    await expect(
      provider.complete({ systemPrompt: "system", userPrompt: "user" })
    ).rejects.toMatchObject({ code: "AI_PROVIDER_ERROR" })
  })

  it("aborts requests after the configured timeout", async () => {
    const fetchImplementation = vi.fn<typeof fetch>((_input, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () =>
          reject(new DOMException("aborted", "AbortError"))
        )
      })
    )
    const provider = createOpenAiCompatibleProvider({
      getSettings: configuredSettings,
      fetchImplementation,
      timeoutMs: 5
    })

    await expect(
      provider.complete({ systemPrompt: "system", userPrompt: "user" })
    ).rejects.toMatchObject({ code: "AI_TIMEOUT" })
  })

  it("returns validated content from a normal completion", async () => {
    const fetchImplementation = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({
        id: "completion-1",
        choices: [{ message: { role: "assistant", content: "  valid result  " } }]
      })
    )
    const provider = createOpenAiCompatibleProvider({
      getSettings: configuredSettings,
      fetchImplementation
    })

    await expect(
      provider.complete({ systemPrompt: "system", userPrompt: "user", jsonMode: true })
    ).resolves.toBe("valid result")
    expect(fetchImplementation).toHaveBeenCalledOnce()
  })

  it("normalizes base URLs and accepts a complete endpoint", () => {
    expect(resolveChatCompletionsUrl("https://api.example.test/v1/")).toBe(
      "https://api.example.test/v1/chat/completions"
    )
    expect(
      resolveChatCompletionsUrl("http://127.0.0.1:11434/api/chat/completions")
    ).toBe("http://127.0.0.1:11434/api/chat/completions")
  })
})

