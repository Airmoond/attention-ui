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

export const PairRequestSchema = z
  .object({
    pairingToken: z.string().trim().min(1).max(64)
  })
  .strict()

export const AuthStateSchema = z
  .object({
    pairingToken: z.string().min(1).max(64),
    clientToken: z.string().min(20).max(200).nullable(),
    tokenVersion: z.number().int().min(0),
    lastConnectedAt: z.string().datetime().nullable()
  })
  .strict()
