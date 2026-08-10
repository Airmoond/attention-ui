import type { BackgroundMessageResult } from "../communication/messages"
import { describe, expect, it } from "vitest"
import { getAiToolFallbackMessage } from "./FocusUIRoot"

const connectionResult = (
  connectionStatus: "offline" | "online_unpaired" | "online_paired" | "auth_expired",
  aiConfigured: boolean | null = null
): BackgroundMessageResult => ({
  ok: true,
  connectionStatus,
  health:
    aiConfigured === null
      ? null
      : { ok: true, service: "focusui-desktop", version: "0.1.0", aiConfigured },
  message: null
})

describe("AI tool fallback messages", () => {
  it("reports an offline desktop", () => {
    expect(getAiToolFallbackMessage(connectionResult("offline"))).toBe("FocusUI Desktop未连接")
  })

  it("reports missing or expired pairing", () => {
    expect(getAiToolFallbackMessage(connectionResult("online_unpaired", false))).toBe(
      "尚未与FocusUI Desktop配对"
    )
    expect(getAiToolFallbackMessage(connectionResult("auth_expired", false))).toBe(
      "尚未与FocusUI Desktop配对"
    )
  })

  it("reports missing AI configuration", () => {
    expect(getAiToolFallbackMessage(connectionResult("online_paired", false))).toBe(
      "请先在桌面端配置AI服务"
    )
  })

  it("does not pretend an AI feature is implemented", () => {
    expect(getAiToolFallbackMessage(connectionResult("online_paired", true))).toBe(
      "该AI功能将在下一模块接入"
    )
  })

  it("treats background communication failures as unavailable", () => {
    expect(
      getAiToolFallbackMessage({
        ok: false,
        code: "BACKGROUND_UNAVAILABLE",
        message: "FocusUI 后台服务不可用"
      })
    ).toBe("FocusUI Desktop未连接")
  })
})
