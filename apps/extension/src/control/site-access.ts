import { SiteOriginSchema, SitePoliciesSchema, SitePolicySchema, type SiteOrigin, type SitePolicy, type PageAccess } from "@focus-ui/shared/extension"
import type { PageContext } from "@focus-ui/shared"
import { getExtensionSettings } from "../storage/extension-store"
import { extractNumericCandidates } from "../context/number-extractor"

export const SITE_STORAGE_KEY = "sitePoliciesV1"
export const DEFAULT_SITE_POLICY: SitePolicy = { enabled: false, autoToolbar: false, autoAI: false }
export const getSiteOrigin = (address: string): SiteOrigin | null => {
  try {
    const url = new URL(address)
    const origin = SiteOriginSchema.safeParse(url.origin)
    if (!origin.success || url.username || url.password) return null
    if (url.port === "17321" && !url.pathname.startsWith("/demo/")) return null
    return origin.data
  } catch { return null }
}
export const sitePattern = (origin: SiteOrigin): string => origin + (origin.endsWith(":17321") ? "/demo/*" : "/*")
export const pauseKey = (tabId: number): string => "focusuiPaused:" + tabId

export async function getSitePolicies(): Promise<ReturnType<typeof SitePoliciesSchema.parse>> {
  const stored = await chrome.storage.local.get(SITE_STORAGE_KEY)
  const parsed = SitePoliciesSchema.safeParse(stored[SITE_STORAGE_KEY])
  // Missing/invalid website settings fail closed without touching existing keys.
  return parsed.success ? parsed.data : { version: 1, sites: {} }
}
let writes: Promise<unknown> = Promise.resolve()
export function updateSitePolicy(origin: SiteOrigin, policy: SitePolicy): Promise<void> {
  const task = writes.then(async () => {
    const key = SiteOriginSchema.parse(origin)
    const value = SitePolicySchema.parse(policy)
    const stored = await getSitePolicies()
    stored.sites[key] = value
    await chrome.storage.local.set({ [SITE_STORAGE_KEY]: stored })
  })
  writes = task.catch(() => undefined) // Keep subsequent writes usable; task still rejects to the caller.
  return task
}
export async function getPageAccess(address: string, tabId: number): Promise<PageAccess> {
  const origin = getSiteOrigin(address)
  const [settings, policies, pause] = await Promise.all([
    getExtensionSettings(), getSitePolicies(), chrome.storage.session.get(pauseKey(tabId))
  ])
  const policy = (origin && policies.sites[origin]) || DEFAULT_SITE_POLICY
  const permission = origin ? await chrome.permissions.contains({ origins: [sitePattern(origin)] }) : false
  const paused = pause[pauseKey(tabId)] === true
  return { origin, ...policy, globalEnabled: settings.enabled, permission, paused,
    active: Boolean(origin && settings.enabled && policy.enabled && permission && !paused) }
}
export function minimizePageContext(context: PageContext, senderAddress: string): PageContext {
  if (!getSiteOrigin(senderAddress)) throw new Error("Unsupported context origin")
  const url = new URL(senderAddress)
  const text = context.selectedText || context.text
  return { ...context, url: url.origin + url.pathname, pageTitle: "", nearbyHeading: null,
    text, numericCandidates: extractNumericCandidates(text) }
}
