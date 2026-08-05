import { randomBytes, randomInt, timingSafeEqual } from "node:crypto"
import type { ApiError, AuthState, PairingStatus, PairResponse } from "@focus-ui/shared"

const PAIRING_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"

export type AuthStateStorage = {
  getState: () => AuthState
  setState: (state: AuthState) => void
}

export type AuthController = {
  pair: (pairingToken: string) => PairResponse | ApiError
  authorize: (clientToken: string) => boolean
  getPairingStatus: () => PairingStatus
  regeneratePairingToken: () => PairingStatus
  disconnectPlugin: () => PairingStatus
}

const generateTokenSegment = (length: number): string => {
  let segment = ""
  for (let index = 0; index < length; index += 1) {
    segment += PAIRING_ALPHABET[randomInt(PAIRING_ALPHABET.length)]
  }
  return segment
}

export const generatePairingToken = (): string =>
  `FUI-${generateTokenSegment(4)}-${generateTokenSegment(4)}`

export const createInitialAuthState = (): AuthState => ({
  pairingToken: generatePairingToken(),
  clientToken: null,
  tokenVersion: 0,
  lastConnectedAt: null
})

const tokensMatch = (expected: string, candidate: string): boolean => {
  const expectedBuffer = Buffer.from(expected)
  const candidateBuffer = Buffer.from(candidate)
  return (
    expectedBuffer.length === candidateBuffer.length &&
    timingSafeEqual(expectedBuffer, candidateBuffer)
  )
}

const toPairingStatus = (state: AuthState): PairingStatus => ({
  pairingToken: state.pairingToken,
  paired: state.clientToken !== null,
  lastConnectedAt: state.lastConnectedAt
})

const invalidPairingToken = (): ApiError => ({
  ok: false,
  code: "INVALID_PAIRING_TOKEN",
  message: "配对令牌无效"
})

export const createAuthController = (storage: AuthStateStorage): AuthController => ({
  pair: (pairingToken) => {
    const state = storage.getState()
    if (!tokensMatch(state.pairingToken, pairingToken)) {
      return invalidPairingToken()
    }

    const clientToken = randomBytes(32).toString("base64url")
    storage.setState({ ...state, clientToken, lastConnectedAt: null })
    return { ok: true, clientToken }
  },
  authorize: (clientToken) => {
    const state = storage.getState()
    if (!state.clientToken || !tokensMatch(state.clientToken, clientToken)) {
      return false
    }

    storage.setState({ ...state, lastConnectedAt: new Date().toISOString() })
    return true
  },
  getPairingStatus: () => toPairingStatus(storage.getState()),
  regeneratePairingToken: () => {
    const state = storage.getState()
    const nextState: AuthState = {
      pairingToken: generatePairingToken(),
      clientToken: null,
      tokenVersion: state.tokenVersion + 1,
      lastConnectedAt: null
    }
    storage.setState(nextState)
    return toPairingStatus(nextState)
  },
  disconnectPlugin: () => {
    const state = storage.getState()
    const nextState: AuthState = { ...state, clientToken: null, lastConnectedAt: null }
    storage.setState(nextState)
    return toPairingStatus(nextState)
  }
})
