import { describe, expect, it, vi } from "vitest"
import type { sendExtensionMessage } from "../communication/messages"
import type { BackgroundMessageResult } from "../communication/messages"
import type { LocalTool } from "../policy/local-policy"
import {
  getToolRequestErrorMessage,
  mergePlannedTool,
  recordToolClick
} from "./AttentionUIRoot"

const errorResult = (code: string): BackgroundMessageResult => ({
  ok: false,
  code,
  message: "safe message"
})

describe("AI request failure messages", () => {
  it("reports an offline desktop", () => {
    expect(getToolRequestErrorMessage(errorResult("DESKTOP_UNREACHABLE"))).toBe(
      "AttentionUI Desktop未连接"
    )
    expect(getToolRequestErrorMessage(errorResult("REQUEST_TIMEOUT"))).toBe(
      "AttentionUI Desktop未连接"
    )
  })

  it("distinguishes AI timeout, online request failure, and an updated plugin context", () => {
    expect(getToolRequestErrorMessage(errorResult("AI_REQUEST_TIMEOUT"))).toBe(
      "AI响应超时，请稍后重试"
    )
    expect(getToolRequestErrorMessage(errorResult("DESKTOP_REQUEST_FAILED"))).toBe(
      "Desktop在线，但本次工具请求失败，请重试"
    )
    expect(getToolRequestErrorMessage(errorResult("BACKGROUND_UNAVAILABLE"))).toBe(
      "AttentionUI插件已更新，请刷新当前网页后重试"
    )
  })

  it("reports missing or expired pairing", () => {
    expect(getToolRequestErrorMessage(errorResult("MISSING_CLIENT_TOKEN"))).toBe(
      "尚未与AttentionUI Desktop配对"
    )
    expect(getToolRequestErrorMessage(errorResult("INVALID_CLIENT_TOKEN"))).toBe(
      "配对已失效，请重新连接AttentionUI Desktop"
    )
  })

  it("uses a generic safe message for other failures", () => {
    expect(getToolRequestErrorMessage(errorResult("UNEXPECTED"))).toBe(
      "操作失败，请重试"
    )
  })
})

describe("AI planned tool merge", () => {
  const tools: LocalTool[] = [
    { id: "summarize", label: "总结", availableOffline: false },
    { id: "explain", label: "解释", availableOffline: false },
    { id: "ask", label: "提问", availableOffline: false }
  ]

  it("moves a known suggestion first without duplicates", () => {
    expect(
      mergePlannedTool(tools, {
        toolId: "explain",
        reason: "适合解释",
        confidence: 0.9
      }).map(({ id }) => id)
    ).toEqual(["explain", "summarize", "ask"])
  })

  it("ignores a schema-approved suggestion outside the current allowed set", () => {
    expect(
      mergePlannedTool(tools, {
        toolId: "chart",
        reason: "适合图表",
        confidence: 0.8
      }).map(({ id }) => id)
    ).toEqual(["summarize", "explain", "ask"])
  })
})

describe("tool event recording", () => {
  it("starts recording without waiting and contains only minimal event data", async () => {
    const sendMessage = vi.fn().mockRejectedValue(new Error("desktop offline"))

    expect(
      recordToolClick(
        "focus",
        "text",
        sendMessage as unknown as typeof sendExtensionMessage
      )
    ).toBeUndefined()
    expect(sendMessage).toHaveBeenCalledWith({
      type: "RECORD_TOOL_EVENT",
      event: { eventType: "tool_clicked", contextType: "text", toolId: "focus" }
    })

    await Promise.resolve()
    await Promise.resolve()
  })
})
