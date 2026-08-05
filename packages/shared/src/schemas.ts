import { z } from "zod"

export const AppSettingsSchema = z
  .object({
    apiBaseUrl: z.string(),
    apiKey: z.string(),
    modelName: z.string(),
    attentionDelayMs: z.number().int().min(300).max(3000),
    enableAI: z.boolean(),
    enableLocalTools: z.boolean(),
    enableFocusMode: z.boolean(),
    enableHabitLearning: z.boolean()
  })
  .strict()
