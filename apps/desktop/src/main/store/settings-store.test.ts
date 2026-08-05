import { beforeEach, describe, expect, it, vi } from "vitest"
import { DEFAULT_APP_SETTINGS, type AppSettings } from "@focus-ui/shared"

const persistedData = vi.hoisted(() => ({ settings: null as AppSettings | null }))

vi.mock("electron-store", () => ({
  default: class FakeElectronStore {
    private readonly defaults: { settings: AppSettings }

    constructor(options: { defaults: { settings: AppSettings } }) {
      this.defaults = options.defaults
    }

    get(key: "settings"): AppSettings {
      return persistedData.settings ?? this.defaults[key]
    }

    set(key: "settings", value: AppSettings): void {
      persistedData[key] = value
    }
  }
}))

beforeEach(() => {
  persistedData.settings = null
  vi.resetModules()
})

describe("settings store", () => {
  it("persists valid settings across a store reload and rejects an invalid delay", async () => {
    const firstStore = await import("./settings-store")
    expect(firstStore.getSettings()).toEqual(DEFAULT_APP_SETTINGS)

    const updatedSettings = firstStore.updateSettings({
      ...DEFAULT_APP_SETTINGS,
      apiBaseUrl: "https://api.example.test",
      modelName: "focus-model",
      attentionDelayMs: 1200,
      enableFocusMode: false
    })
    expect(updatedSettings.attentionDelayMs).toBe(1200)
    expect(() =>
      firstStore.updateSettings({ ...updatedSettings, attentionDelayMs: 299 })
    ).toThrow("设置输入无效")

    vi.resetModules()
    const reopenedStore = await import("./settings-store")
    expect(reopenedStore.getSettings()).toEqual(updatedSettings)
  })
})
