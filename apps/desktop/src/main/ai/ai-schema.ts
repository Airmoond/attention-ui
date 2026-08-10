import { z } from "zod"

export const ChatCompletionResponseSchema = z
  .object({
    choices: z
      .array(
        z
          .object({
            message: z
              .object({
                content: z.string().min(1)
              })
              .passthrough()
          })
          .passthrough()
      )
      .min(1)
  })
  .passthrough()

