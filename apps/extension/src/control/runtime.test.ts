import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { executeDesktopTool, planDesktopTools } from "../communication/desktop-client"

vi.mock("../communication/desktop-client", () => ({
  executeDesktopTool: vi.fn(async () => ({ ok: true, data: { toolId: "summarize", success: true, content: "Answer" } })),
  planDesktopTools: vi.fn(async () => ({ ok: true, data: { source: "local", plan: { toolId: "summarize", reason: "local", confidence: 1 } } })),
  checkDesktopAuthentication: vi.fn(), checkDesktopHealth: vi.fn(), getDesktopPreferences: vi.fn(),
  pairDesktop: vi.fn(), recordDesktopToolEvent: vi.fn()
}))
let receive: (message: unknown, sender: chrome.runtime.MessageSender, respond: (value: unknown) => void) => boolean
let local: Record<string, unknown>
let session: Record<string, unknown>
let allowed: boolean
let registeredScripts: { id: string }[]
const origin = "https://en.wikipedia.org"
const sender = { id: "test-extension", url: origin + "/wiki/Physics?secret=1#private", frameId: 0, tab: { id: 1 } } as chrome.runtime.MessageSender
const popup = { id: "test-extension", url: "chrome-extension://test-extension/popup.html" }
const request = (message: unknown, from = sender): Promise<unknown> => new Promise(resolve => receive(message, from, resolve))
const context = { url: origin + "/wiki/Physics?secret=1", pageTitle: "Private title", text: "Adjacent content 99", selectedText: "Selected physics text", nearbyHeading: "Other heading", contextKind: "text", numericCandidates: [] }
const execute = { type: "EXECUTE_TOOL", request: { toolId: "summarize", pageContext: context } }
const event = () => ({ addListener: vi.fn(), removeListener: vi.fn() })
beforeEach(async () => {
  vi.clearAllMocks()
  local = { desktopBaseUrl: "http://127.0.0.1:17321", clientToken: "authenticated-client-token-value", enabled: true,
    sitePoliciesV1: { version: 1, sites: { [origin]: { enabled: true, autoToolbar: false, autoAI: false } } } }
  session = {}; allowed = true; registeredScripts = []
  vi.stubGlobal("defineBackground", (callback: () => void) => ({ main: callback }))
  vi.stubGlobal("chrome", {
    runtime: { id: "test-extension", getURL: (path: string) => "chrome-extension://test-extension/" + path,
      onMessage: { addListener: (callback: typeof receive) => { receive = callback } } },
    permissions: { contains: async () => allowed, onAdded: event(), onRemoved: event() },
    storage: { onChanged: event(), local: {
      get: async (keys: string | Record<string, unknown>) => typeof keys === "string" ? { [keys]: local[keys] } : Object.fromEntries(Object.entries(keys).map(([key, fallback]) => [key, local[key] ?? fallback])),
      set: async (data: Record<string, unknown>) => { Object.assign(local, data) }
    }, session: { get: async (key: string) => ({ [key]: session[key] }), set: async (data: Record<string, unknown>) => { Object.assign(session, data) }, remove: async (key: string) => { delete session[key] } } },
    tabs: { query: async () => [], get: async (id: number) => ({ id, url: sender.url }), onRemoved: event(), sendMessage: vi.fn(async () => ({ ok: true })) },
    scripting: { getRegisteredContentScripts: vi.fn(async () => registeredScripts), registerContentScripts: vi.fn(async () => undefined),
      updateContentScripts: vi.fn(), unregisterContentScripts: vi.fn(), executeScript: vi.fn() }
  })
  const background = await import("../../entrypoints/background")
  background.default.main()
})
afterEach(() => vi.unstubAllGlobals())

describe("background website authorization", () => {
  it("blocks automatic planning by default while allowing manual execution with minimal context", async () => {
    expect(await request({ type: "PLAN_TOOLS", pageContext: context })).toMatchObject({ ok: false, code: "SITE_CONTROL_BLOCKED" })
    expect(planDesktopTools).not.toHaveBeenCalled()
    expect(await request(execute)).toMatchObject({ success: true })
    expect(executeDesktopTool).toHaveBeenCalledWith({ toolId: "summarize", pageContext: {
      ...context, url: origin + "/wiki/Physics", pageTitle: "", nearbyHeading: null, text: context.selectedText
    } })
  })
  it.each(["global", "site", "pause", "permission"])("blocks new requests after %s disable", async mode => {
    if (mode === "global") local.enabled = false
    if (mode === "site") local.sitePoliciesV1 = { version: 1, sites: {} }
    if (mode === "pause") session['attentionuiPaused:1'] = true
    if (mode === "permission") allowed = false
    expect(await request(execute)).toMatchObject({ ok: false, code: "SITE_CONTROL_BLOCKED" })
    expect(executeDesktopTool).not.toHaveBeenCalled()
  })
  it("allows automatic planning only when that website explicitly opts in", async () => {
    local.sitePoliciesV1 = { version: 1, sites: { [origin]: { enabled: true, autoToolbar: false, autoAI: true } } }
    await request({ type: "PLAN_TOOLS", pageContext: context })
    expect(planDesktopTools).toHaveBeenCalledOnce()
  })
  it("does not expose settings or accept website control changes from content scripts", async () => {
    expect(await request({ type: "GET_EXTENSION_SETTINGS" })).toMatchObject({ ok: false })
    expect(await request({ type: "SET_TAB_PAUSED", tabId: 2, paused: true })).toMatchObject({ ok: false })
    expect(await request({ type: "GET_EXTENSION_SETTINGS" }, popup)).toMatchObject({ ok: true })
    expect(await request({ type: "GET_EXTENSION_SETTINGS" }, { ...popup, id: "foreign" })).toMatchObject({ ok: false })
  })
  it("rejects subframe and unrelated page contexts", async () => {
    expect(await request(execute, { ...sender, frameId: 2 })).toMatchObject({ ok: false })
    expect(await request(execute, { ...sender, url: "https://evil.test/article" })).toMatchObject({ ok: false })
    expect(executeDesktopTool).not.toHaveBeenCalled()
  })
  it("keeps pause isolated to one tab and returns a current status to the popup", async () => {
    expect(await request({ type: "SET_TAB_PAUSED", tabId: 1, paused: true }, popup)).toMatchObject({ access: { paused: true, active: false } })
    expect(await request({ type: "GET_TAB_ACCESS", tabId: 2 }, popup)).toMatchObject({ access: { paused: false, active: true } })
    expect(await request({ type: "SET_TAB_PAUSED", tabId: 1, paused: false }, popup)).toMatchObject({ access: { active: true } })
  })
  it("unregisters future injection and notifies existing pages after permission removal", async () => {
    await vi.waitFor(() => expect(chrome.scripting.registerContentScripts).toHaveBeenCalled())
    registeredScripts = [{ id: "attentionui-opt-in" }]
    chrome.tabs.query = vi.fn().mockResolvedValue([{ id: 1, url: sender.url }])
    allowed = false
    const removed = vi.mocked(chrome.permissions.onRemoved.addListener).mock.calls[0]![0]
    removed({ origins: [origin + "/*"] })
    await vi.waitFor(() => expect(chrome.scripting.unregisterContentScripts).toHaveBeenCalledWith({ ids: ["attentionui-opt-in"] }))
    await vi.waitFor(() => expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(1, { type: "ATTENTIONUI_SYNC" }, { frameId: 0 }))
  })
  it("refuses enabling a website without its browser permission", async () => {
    allowed = false
    expect(await request({ type: "SET_SITE_POLICY", tabId: 1, policy: { enabled: true, autoToolbar: false, autoAI: false } }, popup)).toMatchObject({ ok: false })
  })
})
