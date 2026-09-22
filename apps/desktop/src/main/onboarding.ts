import { app } from "electron"
import { join, resolve } from "node:path"

export type OnboardingAssets = {
  guideFile: string
  demoDirectory: string
  extensionDirectory: string
}

export const getOnboardingAssets = (): OnboardingAssets => {
  if (app.isPackaged) {
    const onboardingRoot = join(process.resourcesPath, "onboarding")
    return {
      guideFile: join(onboardingRoot, "QUICK_START.html"),
      demoDirectory: join(onboardingRoot, "demo-pages"),
      extensionDirectory: join(onboardingRoot, "extension")
    }
  }

  const repositoryRoot = resolve(app.getAppPath(), "../..")
  return {
    guideFile: join(repositoryRoot, "QUICK_START.html"),
    demoDirectory: join(repositoryRoot, "demo-pages"),
    extensionDirectory: join(repositoryRoot, "apps", "extension", ".output", "chrome-mv3")
  }
}
