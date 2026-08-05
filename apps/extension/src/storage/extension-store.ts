import {
  DEFAULT_EXTENSION_SETTINGS,
  ExtensionSettingsSchema,
  type ExtensionSettings
} from "@focus-ui/shared/extension"

export type ExtensionSettingsUpdate = Partial<ExtensionSettings>

const getStoredSettings = async (): Promise<Record<string, unknown>> =>
  chrome.storage.local.get(DEFAULT_EXTENSION_SETTINGS)

export const getExtensionSettings = async (): Promise<ExtensionSettings> => {
  const parsedSettings = ExtensionSettingsSchema.safeParse(await getStoredSettings())
  if (parsedSettings.success) {
    return parsedSettings.data
  }

  await chrome.storage.local.set(DEFAULT_EXTENSION_SETTINGS)
  return DEFAULT_EXTENSION_SETTINGS
}

export const updateExtensionSettings = async (
  update: ExtensionSettingsUpdate
): Promise<ExtensionSettings> => {
  const currentSettings = await getExtensionSettings()
  const parsedSettings = ExtensionSettingsSchema.safeParse({ ...currentSettings, ...update })

  if (!parsedSettings.success) {
    throw new Error("插件设置无效：桌面服务地址仅支持本机地址")
  }

  await chrome.storage.local.set(parsedSettings.data)
  return parsedSettings.data
}

export const clearClientToken = async (): Promise<ExtensionSettings> => {
  const currentSettings = await getExtensionSettings()
  const nextSettings: ExtensionSettings = { ...currentSettings, clientToken: null }
  await chrome.storage.local.set(nextSettings)
  return nextSettings
}
