import type { RequestHandler } from "express"
import { PairRequestSchema, type ApiError } from "@focus-ui/shared"
import type { AuthController } from "../auth"

export const createPairRoute = (authController: AuthController): RequestHandler => {
  return (request, response): void => {
    const parsedRequest = PairRequestSchema.safeParse(request.body)
    if (!parsedRequest.success) {
      response.status(400).json({
        ok: false,
        code: "INVALID_PAIR_REQUEST",
        message: "配对请求格式无效"
      } satisfies ApiError)
      return
    }

    const pairResult = authController.pair(parsedRequest.data.pairingToken)
    response.status(pairResult.ok ? 200 : 401).json(pairResult)
  }
}
