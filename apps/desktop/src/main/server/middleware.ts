import type { RequestHandler } from "express"
import type { ApiError } from "@attention-ui/shared"
import type { AuthController } from "./auth"
import { appLogger } from "../logger/logger"

const DEVELOPMENT_ORIGINS = new Set(["http://localhost:5173", "http://127.0.0.1:5173"])

const unauthorized = (code: string, message: string): ApiError => ({ ok: false, code, message })

const isAllowedOrigin = (origin: string): boolean => {
  if (DEVELOPMENT_ORIGINS.has(origin)) {
    return true
  }

  if (!origin.startsWith("chrome-extension://")) {
    return false
  }

  try {
    const parsedOrigin = new URL(origin)
    return parsedOrigin.protocol === "chrome-extension:" && parsedOrigin.host.length > 0
  } catch (_error: unknown) {
    return false
  }
}

export const createCorsMiddleware = (): RequestHandler => (request, response, next): void => {
  const origin = request.get("origin")
  if (!origin) {
    next()
    return
  }

  if (!isAllowedOrigin(origin)) {
    response.status(403).json({
      ok: false,
      code: "ORIGIN_NOT_ALLOWED",
      message: "请求来源不被允许"
    } satisfies ApiError)
    return
  }

  response.header("Access-Control-Allow-Origin", origin)
  response.header("Access-Control-Allow-Headers", "Authorization, Content-Type")
  response.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
  response.header("Vary", "Origin")

  if (request.method === "OPTIONS") {
    response.sendStatus(204)
    return
  }

  next()
}

export const createAuthMiddleware = (authController: AuthController): RequestHandler => {
  return (request, response, next): void => {
    const authorization = request.get("authorization")
    if (!authorization) {
      appLogger.warning("PLUGIN_AUTH_FAILED", "插件请求缺少鉴权", {
        errorCode: "MISSING_AUTHORIZATION",
        statusCode: 401
      })
      response.status(401).json(unauthorized("MISSING_AUTHORIZATION", "缺少 Authorization 请求头"))
      return
    }

    const match = /^Bearer ([^\s]+)$/.exec(authorization)
    if (!match?.[1]) {
      appLogger.warning("PLUGIN_AUTH_FAILED", "插件请求鉴权格式无效", {
        errorCode: "INVALID_AUTHORIZATION",
        statusCode: 401
      })
      response.status(401).json(unauthorized("INVALID_AUTHORIZATION", "Authorization 格式无效"))
      return
    }

    if (!authController.authorize(match[1])) {
      appLogger.warning("PLUGIN_AUTH_FAILED", "插件客户端令牌无效", {
        errorCode: "INVALID_CLIENT_TOKEN",
        statusCode: 401
      })
      response.status(401).json(unauthorized("INVALID_CLIENT_TOKEN", "客户端令牌无效或已失效"))
      return
    }

    next()
  }
}
