import type { RequestHandler } from "express"
import {
  PlanRequestSchema,
  PlanResponseSchema,
  type ApiError,
  type PageContext,
  type PlanResponse
} from "@focus-ui/shared"

export type PlanPageContext = (pageContext: PageContext) => Promise<PlanResponse>

export const createPlanRoute = (planPageContext: PlanPageContext): RequestHandler => {
  return (request, response): void => {
    const parsedRequest = PlanRequestSchema.safeParse(request.body)
    if (!parsedRequest.success) {
      response.status(400).json({
        ok: false,
        code: "INVALID_PLAN_REQUEST",
        message: "规划请求格式无效"
      } satisfies ApiError)
      return
    }

    void planPageContext(parsedRequest.data.pageContext)
      .then((result) => {
        const parsedResult = PlanResponseSchema.safeParse(result)
        if (!parsedResult.success) {
          response.status(500).json({
            ok: false,
            code: "INVALID_PLAN_RESPONSE",
            message: "规划结果无法安全使用"
          } satisfies ApiError)
          return
        }
        response.status(200).json(parsedResult.data)
      })
      .catch((_error: unknown) => {
        response.status(500).json({
          ok: false,
          code: "PLAN_FAILED",
          message: "工具规划暂时不可用"
        } satisfies ApiError)
      })
  }
}
