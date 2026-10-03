import { Menu, Tray, nativeImage, type MenuItemConstructorOptions } from "electron"
import trayIconBase64 from "../../resources/tray-icon.png.base64?raw"
import { getTrayServiceMenuState } from "./tray-logic"

export type FocusTrayOptions = {
  showWindow: () => void
  startService: () => Promise<unknown>
  stopService: () => Promise<unknown>
  isServiceRunning: () => boolean
  quitApplication: () => void
}

export type FocusTrayController = {
  refreshMenu: () => void
  notifyRunningInBackground: () => void
  destroy: () => void
}

let applicationTray: Tray | null = null
let activeOptions: FocusTrayOptions | null = null
let backgroundNotificationShown = false

const createTrayImage = () => {
  const image = nativeImage.createFromBuffer(
    Buffer.from(trayIconBase64.trim(), "base64")
  )
  if (image.isEmpty()) {
    throw new Error("TRAY_ICON_INVALID")
  }
  return image
}

const runServiceAction = async (action: "start" | "stop"): Promise<void> => {
  const options = activeOptions
  if (!options) {
    return
  }
  try {
    await (action === "start" ? options.startService() : options.stopService())
  } finally {
    refreshTrayMenu()
  }
}

const buildTrayMenu = (): Electron.Menu => {
  const options = activeOptions
  const menuState = getTrayServiceMenuState(options?.isServiceRunning() ?? false)
  const template: MenuItemConstructorOptions[] = [
    {
      label: "打开AttentionUI",
      click: (): void => options?.showWindow()
    },
    { type: "separator" },
    {
      label: "启动服务",
      enabled: menuState.startEnabled,
      click: (): void => {
        void runServiceAction("start")
      }
    },
    {
      label: "停止服务",
      enabled: menuState.stopEnabled,
      click: (): void => {
        void runServiceAction("stop")
      }
    },
    { type: "separator" },
    {
      label: "退出",
      click: (): void => options?.quitApplication()
    }
  ]
  return Menu.buildFromTemplate(template)
}

const refreshTrayMenu = (): void => {
  applicationTray?.setContextMenu(buildTrayMenu())
}

export const createFocusTray = (options: FocusTrayOptions): FocusTrayController => {
  activeOptions = options
  if (!applicationTray) {
    applicationTray = new Tray(createTrayImage())
    applicationTray.setToolTip("AttentionUI Desktop")
    applicationTray.on("click", options.showWindow)
  }
  refreshTrayMenu()

  return {
    refreshMenu: refreshTrayMenu,
    notifyRunningInBackground: (): void => {
      if (!applicationTray || backgroundNotificationShown) {
        return
      }
      backgroundNotificationShown = true
      if (process.platform === "win32") {
        applicationTray.displayBalloon({
          title: "AttentionUI",
          content: "AttentionUI仍在后台运行",
          iconType: "info",
          noSound: true,
          respectQuietTime: true
        })
      }
    },
    destroy: (): void => {
      applicationTray?.destroy()
      applicationTray = null
      activeOptions = null
    }
  }
}
