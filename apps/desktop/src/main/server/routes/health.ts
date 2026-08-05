import type { RequestHandler } from "express"
import type { HealthResponse } from "@focus-ui/shared"

type HealthRouteOptions = {
  getVersion: () => string
  getAiConfigured: () => boolean
}

export const createHealthRoute = ({
  getVersion,
  getAiConfigured
}: HealthRouteOptions): RequestHandler => {
  return (_request, response): void => {
    const health: HealthResponse = {
      ok: true,
      service: "focusui-desktop",
      version: getVersion(),
      aiConfigured: getAiConfigured()
    }

    response.status(200).json(health)
  }
}
