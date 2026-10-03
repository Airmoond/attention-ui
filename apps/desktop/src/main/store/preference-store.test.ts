import { beforeEach, describe, expect, it, vi } from "vitest"
import type { PreferenceState } from "@attention-ui/shared"

const persistedData = vi.hoisted(() => ({ preferences: null as PreferenceState | null }))

vi.mock("electron-store", () => ({
  default: class FakeElectronStore {
    private readonly defaults: { preferences: PreferenceState }

    constructor(options: { defaults: { preferences: PreferenceState } }) {
      this.defaults = options.defaults
    }

    get(key: "preferences"): PreferenceState {
      return persistedData.preferences ?? this.defaults[key]
    }

    set(key: "preferences", value: PreferenceState): void {
      persistedData[key] = value
    }
  }
}))

beforeEach(() => {
  persistedData.preferences = null
  vi.resetModules()
})

describe("preference store", () => {
  it("starts empty and records global, context, and server timestamps", async () => {
    const store = await import("./preference-store")
    expect(store.getPreferenceState()).toEqual({
      globalToolCount: {},
      contextToolCount: {},
      lastUsedAt: {},
      pinnedTools: []
    })

    store.recordToolEvent(
      { eventType: "tool_clicked", contextType: "numbers", toolId: "chart" },
      1_700_000_000_000
    )
    const updated = store.recordToolEvent(
      { eventType: "tool_clicked", contextType: "numbers", toolId: "chart" },
      1_700_000_000_100
    )

    expect(updated.globalToolCount.chart).toBe(2)
    expect(updated.contextToolCount.numbers?.chart).toBe(2)
    expect(updated.lastUsedAt.chart).toBe(1_700_000_000_100)
  })

  it("reads recorded preferences after the store module is reopened", async () => {
    const firstStore = await import("./preference-store")
    firstStore.recordToolEvent(
      { eventType: "tool_clicked", contextType: "code", toolId: "explain" },
      1234
    )

    vi.resetModules()
    const reopenedStore = await import("./preference-store")
    expect(reopenedStore.getPreferenceState()).toMatchObject({
      globalToolCount: { explain: 1 },
      contextToolCount: { code: { explain: 1 } },
      lastUsedAt: { explain: 1234 }
    })
  })

  it("resets every learned preference field", async () => {
    const store = await import("./preference-store")
    store.recordToolEvent(
      { eventType: "tool_clicked", contextType: "table", toolId: "extract" },
      5678
    )

    expect(store.resetPreferences()).toEqual({
      globalToolCount: {},
      contextToolCount: {},
      lastUsedAt: {},
      pinnedTools: []
    })
    expect(store.getPreferenceState()).toEqual(store.createDefaultPreferenceState())
  })
})
