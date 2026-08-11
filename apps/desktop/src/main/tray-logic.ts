export type WindowCloseDecision = "hide" | "close"

export const getWindowCloseDecision = (isQuitting: boolean): WindowCloseDecision =>
  isQuitting ? "close" : "hide"

export type TrayServiceMenuState = {
  startEnabled: boolean
  stopEnabled: boolean
}

export const getTrayServiceMenuState = (serviceRunning: boolean): TrayServiceMenuState => ({
  startEnabled: !serviceRunning,
  stopEnabled: serviceRunning
})
