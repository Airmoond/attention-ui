import { constants, copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs"
import { join, resolve } from "node:path"
import { z } from "zod"
import { AppSettingsSchema, AuthStateSchema, PreferenceStateSchema } from "@attention-ui/shared"

// These names identify existing installations; they are not current branding.
const LEGACY_APPLICATION_DIRECTORIES = [
  "@focus-ui/desktop", "FocusUI", "FocusUI 0.1.1 学生测试版", "FocusUI 0.1 Beta"
]
const CONFIGURATIONS = [
  { source: "focus-ui-settings.json", target: "attention-ui-settings.json", schema: z.object({ settings: AppSettingsSchema }).strict() },
  { source: "focus-ui-auth.json", target: "attention-ui-auth.json", schema: z.object({ auth: AuthStateSchema }).strict() },
  { source: "focus-ui-preferences.json", target: "attention-ui-preferences.json", schema: z.object({ preferences: PreferenceStateSchema }).strict() }
]

export const migrateLegacyData = (
  appDataDirectory: string,
  userDataDirectory: string
): { migrated: number; failed: number } => {
  let migrated = 0
  let failed = 0
  for (const configuration of CONFIGURATIONS) {
    const target = join(userDataDirectory, configuration.target)
    if (existsSync(target)) continue
    for (const directory of LEGACY_APPLICATION_DIRECTORIES) {
      const source = join(appDataDirectory, directory, configuration.source)
      if (resolve(source) === resolve(target) || !existsSync(source)) continue
      try {
        const input: unknown = JSON.parse(readFileSync(source, "utf8"))
        if (!configuration.schema.safeParse(input).success) continue
        mkdirSync(userDataDirectory, { recursive: true })
        copyFileSync(source, target, constants.COPYFILE_EXCL)
        migrated += 1
        break
      } catch (_error: unknown) {
        failed += 1
      }
    }
  }
  return { migrated, failed }
}
