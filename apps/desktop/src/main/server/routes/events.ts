import type { RequestHandler } from "express"
import {
  ToolEventSchema,
  type ApiError,
  type ToolEvent,
  type ToolEventResponse
} from "@focus-ui/shared"
import { appLogger } from "../../logger/logger"

export type RecordToolEvent = (event: ToolEvent) => void

export const createEventsRoute = (recordToolEvent: RecordToolEvent): RequestHandler => {
  return (request, response): void => {
    const parsedEvent = ToolEventSchema.safeParse(request.body)
    if (!parsedEvent.success) {
      response.status(400).json({
        ok: false,
        code: "INVALID_TOOL_EVENT",
        message: "工具事件格式无效"
      } satisfies ApiError)
      return
    }

    try {
      recordToolEvent(parsedEvent.data)
      appLogger.info("TOOL_EVENT_RECORDED", "工具使用事件已记录", {
        toolId: parsedEvent.data.toolId,
        contextKind: parsedEvent.data.contextType
      })
      response.status(200).json({ ok: true } satisfies ToolEventResponse)
    } catch (_error: unknown) {
      appLogger.warning("TOOL_EVENT_RECORD_FAILED", "工具使用事件记录失败", {
        toolId: parsedEvent.data.toolId,
        contextKind: parsedEvent.data.contextType,
        errorCode: "PREFERENCE_STORE_WRITE_FAILED"
      })
      response.status(500).json({
        ok: false,
        code: "TOOL_EVENT_RECORD_FAILED",
        message: "工具事件记录失败"
      } satisfies ApiError)
    }
  }
}
