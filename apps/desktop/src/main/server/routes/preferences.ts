import type { RequestHandler } from "express"
import type { PreferenceState, PreferencesResponse } from "@focus-ui/shared"
import { appLogger } from "../../logger/logger"

export type GetPreferences = () => PreferenceState
export type ResetPreferences = () => PreferenceState

export const createGetPreferencesRoute = (
  getPreferences: GetPreferences
): RequestHandler => {
  return (_request, response): void => {
    response.status(200).json({
      ok: true,
      preferences: getPreferences()
    } satisfies PreferencesResponse)
  }
}

export const createResetPreferencesRoute = (
  resetPreferences: ResetPreferences
): RequestHandler => {
  return (_request, response): void => {
    const preferences = resetPreferences()
    appLogger.info("PREFERENCES_RESET", "习惯数据已清除")
    response.status(200).json({
      ok: true,
      preferences
    } satisfies PreferencesResponse)
  }
}
