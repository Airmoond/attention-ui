import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import { DEFAULT_APP_SETTINGS } from "@attention-ui/shared"
import { migrateLegacyData } from "./legacy-data"

const directories: string[] = []
const fixture = (): { root: string; old: string; current: string } => {
  const root = mkdtempSync(join(tmpdir(), "attentionui-migration-"))
  directories.push(root)
  const old = join(root, "@focus-ui/desktop")
  const current = join(root, "@attention-ui/desktop")
  mkdirSync(old, { recursive: true })
  return { root, old, current }
}
afterEach(() => { for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true }) })

describe("legacy installation migration", () => {
  it("retains validated AI settings, pairing and habits without changing the source", () => {
    const { root, old, current } = fixture()
    const settings = { settings: { ...DEFAULT_APP_SETTINGS, apiKey: "migration-test-placeholder", modelName: "test-model" } }
    const auth = { auth: { pairingToken: "old-pairing-token", clientToken: "migration-test-client-token", tokenVersion: 1, lastConnectedAt: null } }
    const preferences = { preferences: { globalToolCount: { explain: 3 }, contextToolCount: {}, lastUsedAt: {}, pinnedTools: [] } }
    for (const [kind, value] of Object.entries({ settings, auth, preferences })) writeFileSync(join(old, `focus-ui-${kind}.json`), JSON.stringify(value))
    expect(migrateLegacyData(root, current)).toEqual({ migrated: 3, failed: 0 })
    for (const [kind, value] of Object.entries({ settings, auth, preferences })) {
      expect(JSON.parse(readFileSync(join(current, `attention-ui-${kind}.json`), "utf8"))).toEqual(value)
      expect(JSON.parse(readFileSync(join(old, `focus-ui-${kind}.json`), "utf8"))).toEqual(value)
    }
  })
  it("never replaces new settings and remains idempotent", () => {
    const { root, old, current } = fixture()
    const original = { settings: DEFAULT_APP_SETTINGS }
    writeFileSync(join(old, "focus-ui-settings.json"), JSON.stringify(original))
    migrateLegacyData(root, current)
    const updated = { settings: { ...DEFAULT_APP_SETTINGS, modelName: "new-choice" } }
    writeFileSync(join(current, "attention-ui-settings.json"), JSON.stringify(updated))
    expect(migrateLegacyData(root, current).migrated).toBe(0)
    expect(JSON.parse(readFileSync(join(current, "attention-ui-settings.json"), "utf8"))).toEqual(updated)
  })
  it("rejects structurally invalid legacy data and leaves unknown files alone", () => {
    const { root, old, current } = fixture()
    writeFileSync(join(old, "focus-ui-settings.json"), JSON.stringify({ settings: { apiKey: "invalid" } }))
    writeFileSync(join(old, "unrelated.json"), "{}")
    expect(migrateLegacyData(root, current)).toEqual({ migrated: 0, failed: 0 })
  })
  it("reports malformed JSON without blocking startup", () => {
    const { root, old, current } = fixture()
    writeFileSync(join(old, "focus-ui-settings.json"), "{")
    expect(migrateLegacyData(root, current)).toEqual({ migrated: 0, failed: 1 })
  })
})
