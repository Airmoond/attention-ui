import Store from "electron-store"
import {
  AppSettingsSchema,
  DEFAULT_APP_SETTINGS,
  type AppSettings
} from "@attention-ui/shared"

type SettingsStoreData = {
  settings: AppSettings
}

let settingsStore: Store<SettingsStoreData> | null = null

const getStore = (): Store<SettingsStoreData> => {
  if (!settingsStore) {
    settingsStore = new Store<SettingsStoreData>({
      name: "attention-ui-settings",
      defaults: {
        settings: DEFAULT_APP_SETTINGS
      }
    })
  }

  return settingsStore
}

export const getSettings = (): AppSettings => {
  const storedSettings = getStore().get("settings")
  const parsedSettings = AppSettingsSchema.safeParse(storedSettings)

  if (parsedSettings.success) {
    return parsedSettings.data
  }

  getStore().set("settings", DEFAULT_APP_SETTINGS)
  return DEFAULT_APP_SETTINGS
}

export const updateSettings = (input: unknown): AppSettings => {
  const parsedSettings = AppSettingsSchema.safeParse(input)

  if (!parsedSettings.success) {
    throw new Error("设置输入无效：鼠标停留时间必须是 300 至 3000 之间的整数。")
  }

  getStore().set("settings", parsedSettings.data)
  return parsedSettings.data
}

export const resetSettings = (): AppSettings => {
  getStore().set("settings", DEFAULT_APP_SETTINGS)
  return DEFAULT_APP_SETTINGS
}

export const isAiConfigured = (): boolean => {
  const settings = getSettings()
  return (
    settings.apiBaseUrl.trim().length > 0 &&
    settings.apiKey.trim().length > 0 &&
    settings.modelName.trim().length > 0
  )
}
