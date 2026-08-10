import type { AppSettings } from "@focus-ui/shared"
import { ChatCompletionResponseSchema } from "./ai-schema"

export const DEFAULT_AI_TIMEOUT_MS = 15_000

export type AiProviderErrorCode =
  | "AI_NOT_CONFIGURED"
  | "AI_TIMEOUT"
  | "AI_AUTH_FAILED"
  | "AI_RATE_LIMITED"
  | "AI_INVALID_RESPONSE"
  | "AI_PROVIDER_ERROR"

export class AiProviderError extends Error {
  public readonly code: AiProviderErrorCode

  public constructor(code: AiProviderErrorCode) {
    super(code)
    this.name = "AiProviderError"
    this.code = code
  }
}

export type AiCompletionRequest = {
  systemPrompt: string
  userPrompt: string
  jsonMode?: boolean
}

export type AiProvider = {
  complete: (request: AiCompletionRequest) => Promise<string>
}

export type AiProviderOptions = {
  getSettings: () => AppSettings
  fetchImplementation?: typeof fetch
  timeoutMs?: number
}

const isAbortError = (error: unknown): boolean =>
  typeof error === "object" &&
  error !== null &&
  "name" in error &&
  error.name === "AbortError"

export const resolveChatCompletionsUrl = (apiBaseUrl: string): string => {
  let parsedUrl: URL
  try {
    parsedUrl = new URL(apiBaseUrl.trim())
  } catch (_error: unknown) {
    throw new AiProviderError("AI_NOT_CONFIGURED")
  }

  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    throw new AiProviderError("AI_NOT_CONFIGURED")
  }

  const normalizedPath = parsedUrl.pathname.replace(/\/+$/u, "")
  parsedUrl.pathname = normalizedPath.endsWith("/chat/completions")
    ? normalizedPath
    : `${normalizedPath}/chat/completions`
  parsedUrl.search = ""
  parsedUrl.hash = ""
  return parsedUrl.toString()
}

const getProviderErrorCode = (status: number): AiProviderErrorCode => {
  if (status === 401 || status === 403) {
    return "AI_AUTH_FAILED"
  }
  if (status === 429) {
    return "AI_RATE_LIMITED"
  }
  return "AI_PROVIDER_ERROR"
}

export const createOpenAiCompatibleProvider = ({
  getSettings,
  fetchImplementation = fetch,
  timeoutMs = DEFAULT_AI_TIMEOUT_MS
}: AiProviderOptions): AiProvider => ({
  complete: async ({ systemPrompt, userPrompt, jsonMode = false }): Promise<string> => {
    const settings = getSettings()
    if (
      !settings.apiBaseUrl.trim() ||
      !settings.apiKey.trim() ||
      !settings.modelName.trim()
    ) {
      throw new AiProviderError("AI_NOT_CONFIGURED")
    }

    const endpoint = resolveChatCompletionsUrl(settings.apiBaseUrl)
    const controller = new AbortController()
    const timeoutId = globalThis.setTimeout(() => controller.abort(), timeoutMs)

    try {
      const response = await fetchImplementation(endpoint, {
        method: "POST",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${settings.apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: settings.modelName,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
          ],
          temperature: 0.2,
          ...(jsonMode ? { response_format: { type: "json_object" } } : {})
        }),
        signal: controller.signal
      })

      if (!response.ok) {
        throw new AiProviderError(getProviderErrorCode(response.status))
      }

      let responseData: unknown
      try {
        responseData = await response.json()
      } catch (_error: unknown) {
        throw new AiProviderError("AI_INVALID_RESPONSE")
      }

      const parsedResponse = ChatCompletionResponseSchema.safeParse(responseData)
      if (!parsedResponse.success) {
        throw new AiProviderError("AI_INVALID_RESPONSE")
      }

      return parsedResponse.data.choices[0]?.message.content.trim() ?? ""
    } catch (error: unknown) {
      if (error instanceof AiProviderError) {
        throw error
      }
      throw new AiProviderError(isAbortError(error) ? "AI_TIMEOUT" : "AI_PROVIDER_ERROR")
    } finally {
      globalThis.clearTimeout(timeoutId)
    }
  }
})

