import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { SitePoliciesSchema } from "@attention-ui/shared/extension"
import { DEFAULT_SITE_POLICY, getPageAccess, getSiteOrigin, getSitePolicies, minimizePageContext, pauseKey, SITE_STORAGE_KEY, updateSitePolicy } from "./site-access"

let local: Record<string, unknown>
let session: Record<string, unknown>
let permission = true
beforeEach(() => {
  local = { desktopBaseUrl: "http://127.0.0.1:17321", clientToken: "preserved-client-token-value", enabled: true }
  session = {}
  permission = true
  vi.stubGlobal("chrome", { storage: { local: {
    get: async (key: string | Record<string, unknown>) => typeof key === "string" ? { [key]: local[key] } : Object.fromEntries(Object.entries(key).map(([name, fallback]) => [name, local[name] ?? fallback])),
    set: async (values: Record<string, unknown>) => { Object.assign(local, values) }
  }, session: { get: async (key: string) => ({ [key]: session[key] }) } }, permissions: { contains: async () => permission } })
})
afterEach(() => vi.unstubAllGlobals())
const origin = "https://en.wikipedia.org" as const

describe("website control boundaries", () => {
  it("upgrades legacy settings to opt-in manual defaults while preserving pairing", async () => {
    expect(await getSitePolicies()).toEqual({ version: 1, sites: {} })
    expect(await getPageAccess(origin + "/wiki/Physics", 1)).toMatchObject({ ...DEFAULT_SITE_POLICY, active: false })
    await updateSitePolicy(origin, { ...DEFAULT_SITE_POLICY, enabled: true })
    expect(local.clientToken).toBe("preserved-client-token-value")
    expect(local.enabled).toBe(true)
    expect(await getPageAccess(origin + "/wiki/Physics", 1)).toMatchObject({ active: true, autoToolbar: false, autoAI: false })
  })
  it("persists independent websites without lost concurrent writes", async () => {
    await Promise.all([updateSitePolicy(origin, { enabled: true, autoToolbar: true, autoAI: false }),
      updateSitePolicy("https://zh.wikipedia.org", { enabled: true, autoToolbar: false, autoAI: true })])
    expect(Object.keys((await getSitePolicies()).sites)).toHaveLength(2)
    expect((await getSitePolicies()).sites[origin]?.autoAI).toBe(false)
  })
  it("fails closed for corrupt policy without clearing credentials", async () => {
    local[SITE_STORAGE_KEY] = { version: 1, sites: { [origin]: { enabled: "true" } } }
    expect((await getPageAccess(origin, 1)).active).toBe(false)
    expect(local.clientToken).toBe("preserved-client-token-value")
  })
  it("requires global enable, site enable, permission, and no per-tab pause", async () => {
    await updateSitePolicy(origin, { enabled: true, autoToolbar: true, autoAI: true })
    session[pauseKey(1)] = true
    expect((await getPageAccess(origin, 1)).active).toBe(false)
    expect((await getPageAccess(origin, 2)).active).toBe(true)
    permission = false
    expect((await getPageAccess(origin, 2)).active).toBe(false)
    permission = true
    local.enabled = false
    expect((await getPageAccess(origin, 2)).active).toBe(false)
  })
  it.each(["https://en.wikipedia.org.evil.test/wiki/X", "https://user:secret@en.wikipedia.org/wiki/X", "http://en.wikipedia.org/wiki/X", "https://en.wikipedia.org:444/wiki/X", "file:///E:/lecture.pdf", "http://127.0.0.1:17321/health", "chrome://extensions"])("rejects unsupported or deceptive URL %s", value => {
    expect(getSiteOrigin(value)).toBeNull()
  })
  it("allows the agreed sites and local demo paths", () => {
    expect(getSiteOrigin("https://baike.baidu.com/item/test/123")).toBe("https://baike.baidu.com")
    expect(getSiteOrigin("http://localhost:17321/demo/article.html")).toBe("http://localhost:17321")
    expect(SitePoliciesSchema.safeParse({ version: 1, sites: { "https://evil.test": DEFAULT_SITE_POLICY } }).success).toBe(false)
  })
  it("removes query, fragment, title and adjacent context before sending a selected passage", () => {
    const result = minimizePageContext({ url: "https://evil.test/private", pageTitle: "Private name", text: "Other paragraph 999",
      selectedText: "Selected 2024 and 12", nearbyHeading: "Private heading", contextKind: "text", numericCandidates: [] },
    origin + "/wiki/Physics?token=secret#private")
    expect(result).toMatchObject({ url: origin + "/wiki/Physics", pageTitle: "", nearbyHeading: null, text: "Selected 2024 and 12" })
    expect(JSON.stringify(result)).not.toMatch(/secret|Private|999|evil/)
  })
})

