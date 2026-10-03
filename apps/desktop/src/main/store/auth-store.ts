import Store from "electron-store"
import { AuthStateSchema, type AuthState, type PairingStatus } from "@attention-ui/shared"
import { createAuthController, createInitialAuthState } from "../server/auth"

type AuthStoreData = {
  auth: AuthState
}

let authStore: Store<AuthStoreData> | null = null

const getStore = (): Store<AuthStoreData> => {
  if (!authStore) {
    authStore = new Store<AuthStoreData>({
      name: "attention-ui-auth",
      defaults: {
        auth: createInitialAuthState()
      }
    })
  }

  return authStore
}

const getAuthState = (): AuthState => {
  const parsedState = AuthStateSchema.safeParse(getStore().get("auth"))
  if (parsedState.success) {
    return parsedState.data
  }

  const resetState = createInitialAuthState()
  getStore().set("auth", resetState)
  return resetState
}

const setAuthState = (state: AuthState): void => {
  getStore().set("auth", state)
}

const authController = createAuthController({ getState: getAuthState, setState: setAuthState })

export const getFocusAuthController = (): typeof authController => authController

export const getPairingStatus = (): PairingStatus => authController.getPairingStatus()

export const regeneratePairingToken = (): PairingStatus => authController.regeneratePairingToken()

export const disconnectPlugin = (): PairingStatus => authController.disconnectPlugin()
