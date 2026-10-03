import { afterEach, describe, expect, it, vi } from "vitest"

type FakeMenuItem = {
  label?: string
  enabled?: boolean
  click?: () => void
}

const electronMocks = vi.hoisted(() => {
  class FakeTray {
    public static instances: FakeTray[] = []
    public menu: { template: FakeMenuItem[] } | null = null
    public destroyed = false
    public balloons: unknown[] = []

    public constructor(_image: unknown) {
      FakeTray.instances.push(this)
    }

    public setToolTip(_toolTip: string): void {}
    public on(_event: string, _listener: () => void): void {}
    public setContextMenu(menu: { template: FakeMenuItem[] }): void {
      this.menu = menu
    }
    public displayBalloon(options: unknown): void {
      this.balloons.push(options)
    }
    public destroy(): void {
      this.destroyed = true
    }
  }

  return {
    FakeTray,
    buildFromTemplate: (template: FakeMenuItem[]): { template: FakeMenuItem[] } => ({
      template
    })
  }
})

vi.mock("electron", () => ({
  Menu: { buildFromTemplate: electronMocks.buildFromTemplate },
  Tray: electronMocks.FakeTray,
  nativeImage: {
    createFromBuffer: () => ({ isEmpty: () => false })
  }
}))

const menuItem = (tray: InstanceType<typeof electronMocks.FakeTray>, label: string): FakeMenuItem => {
  const item = tray.menu?.template.find((candidate) => candidate.label === label)
  if (!item) {
    throw new Error(`Missing tray menu item: ${label}`)
  }
  return item
}

afterEach(() => {
  electronMocks.FakeTray.instances.length = 0
})

describe("tray controller", () => {
  it("creates one tray and wires service actions with refreshed enable states", async () => {
    const { createFocusTray } = await import("./tray")
    let running = true
    const startService = vi.fn(async () => {
      running = true
    })
    const stopService = vi.fn(async () => {
      running = false
    })
    const options = {
      showWindow: vi.fn(),
      startService,
      stopService,
      isServiceRunning: (): boolean => running,
      quitApplication: vi.fn()
    }

    const firstController = createFocusTray(options)
    const secondController = createFocusTray(options)
    expect(electronMocks.FakeTray.instances).toHaveLength(1)
    const tray = electronMocks.FakeTray.instances[0]
    expect(tray).toBeDefined()
    expect(menuItem(tray as InstanceType<typeof electronMocks.FakeTray>, "启动服务").enabled).toBe(false)
    expect(menuItem(tray as InstanceType<typeof electronMocks.FakeTray>, "停止服务").enabled).toBe(true)

    menuItem(tray as InstanceType<typeof electronMocks.FakeTray>, "停止服务").click?.()
    await Promise.resolve()
    await Promise.resolve()
    expect(stopService).toHaveBeenCalledOnce()
    expect(menuItem(tray as InstanceType<typeof electronMocks.FakeTray>, "启动服务").enabled).toBe(true)
    expect(menuItem(tray as InstanceType<typeof electronMocks.FakeTray>, "停止服务").enabled).toBe(false)

    menuItem(tray as InstanceType<typeof electronMocks.FakeTray>, "启动服务").click?.()
    await Promise.resolve()
    await Promise.resolve()
    expect(startService).toHaveBeenCalledOnce()

    menuItem(tray as InstanceType<typeof electronMocks.FakeTray>, "打开AttentionUI").click?.()
    menuItem(tray as InstanceType<typeof electronMocks.FakeTray>, "退出").click?.()
    expect(options.showWindow).toHaveBeenCalledOnce()
    expect(options.quitApplication).toHaveBeenCalledOnce()

    secondController.destroy()
    expect(tray?.destroyed).toBe(true)
    firstController.destroy()
  })
})
