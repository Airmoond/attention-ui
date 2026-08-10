import { describe, expect, it } from "vitest"
import type { BackgroundMessageResult } from "../communication/messages"
import type { LocalTool } from "../policy/local-policy"
import {
  getToolRequestErrorMessage,
  mergePlannedTool
} from "./FocusUIRoot"

const errorResult = (code: string): BackgroundMessageResult => ({
  ok: false,
  code,
  message: "safe message"
})

describe("AI request failure messages", () => {
  it("reports an offline desktop", () => {
    expect(getToolRequestErrorMessage(errorResult("DESKTOP_UNREACHABLE"))).toBe(
      "FocusUI Desktop未连接"
    )
    expect(getToolRequestErrorMessage(errorResult("REQUEST_TIMEOUT"))).toBe(
      "FocusUI Desktop未连接"
    )
  })

  it("reports missing or expired pairing", () => {
    expect(getToolRequestErrorMessage(errorResult("MISSING_CLIENT_TOKEN"))).toBe(
      "尚未与FocusUI Desktop配对"
    )
    expect(getToolRequestErrorMessage(errorResult("INVALID_CLIENT_TOKEN"))).toBe(
      "尚未与FocusUI Desktop配对"
    )
  })

  it("uses a generic safe message for other failures", () => {
    expect(getToolRequestErrorMessage(errorResult("UNEXPECTED"))).toBe(
      "FocusUI暂时无法处理此操作"
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

  it("adds a schema-approved suggestion while keeping at most three tools", () => {
    expect(
      mergePlannedTool(tools, {
        toolId: "chart",
        reason: "适合图表",
        confidence: 0.8
      }).map(({ id }) => id)
    ).toEqual(["chart", "summarize", "explain"])
  })
})
