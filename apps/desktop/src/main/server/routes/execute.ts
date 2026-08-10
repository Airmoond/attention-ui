import type { RequestHandler } from "express"
import {
  ExecuteRequestSchema,
  ToolResultSchema,
  type ApiError,
  type ExecuteRequest,
  type ToolResult
} from "@focus-ui/shared"

export type ExecuteTool = (request: ExecuteRequest) => Promise<ToolResult>

export const createExecuteRoute = (executeTool: ExecuteTool): RequestHandler => {
  return (request, response): void => {
    const parsedRequest = ExecuteRequestSchema.safeParse(request.body)
    if (!parsedRequest.success) {
      response.status(400).json({
        ok: false,
        code: "INVALID_EXECUTE_REQUEST",
        message: "工具执行请求格式无效"
      } satisfies ApiError)
      return
    }

    void executeTool(parsedRequest.data)
      .then((result) => {
        const parsedResult = ToolResultSchema.safeParse(result)
        if (!parsedResult.success) {
          response.status(500).json({
            ok: false,
            code: "INVALID_TOOL_RESULT",
            message: "工具结果无法安全使用"
          } satisfies ApiError)
          return
        }
        response.status(200).json(parsedResult.data)
      })
      .catch((_error: unknown) => {
        response.status(500).json({
          ok: false,
          code: "EXECUTE_FAILED",
          message: "工具执行暂时不可用"
        } satisfies ApiError)
      })
  }
}
