import Store from "electron-store"
import {
  PreferenceStateSchema,
  ToolEventSchema,
  type PreferenceState,
  type ToolEvent
} from "@focus-ui/shared"

type PreferenceStoreData = {
  preferences: PreferenceState
}

let preferenceStore: Store<PreferenceStoreData> | null = null

export const createDefaultPreferenceState = (): PreferenceState => ({
  globalToolCount: {},
  contextToolCount: {},
  lastUsedAt: {},
  pinnedTools: []
})

const getStore = (): Store<PreferenceStoreData> => {
  if (!preferenceStore) {
    preferenceStore = new Store<PreferenceStoreData>({
      name: "focus-ui-preferences",
      defaults: { preferences: createDefaultPreferenceState() }
    })
  }
  return preferenceStore
}

export const getPreferenceState = (): PreferenceState => {
  const parsedState = PreferenceStateSchema.safeParse(getStore().get("preferences"))
  if (parsedState.success) {
    return parsedState.data
  }

  const defaultState = createDefaultPreferenceState()
  getStore().set("preferences", defaultState)
  return defaultState
}

export const recordToolEvent = (
  input: ToolEvent,
  usedAt = Date.now()
): PreferenceState => {
  const event = ToolEventSchema.parse(input)
  const currentState = getPreferenceState()
  const currentContextCounts = currentState.contextToolCount[event.contextType] ?? {}
  const nextState = PreferenceStateSchema.parse({
    ...currentState,
    globalToolCount: {
      ...currentState.globalToolCount,
      [event.toolId]: (currentState.globalToolCount[event.toolId] ?? 0) + 1
    },
    contextToolCount: {
      ...currentState.contextToolCount,
      [event.contextType]: {
        ...currentContextCounts,
        [event.toolId]: (currentContextCounts[event.toolId] ?? 0) + 1
      }
    },
    lastUsedAt: {
      ...currentState.lastUsedAt,
      [event.toolId]: usedAt
    }
  })
  getStore().set("preferences", nextState)
  return nextState
}

export const resetPreferences = (): PreferenceState => {
  const defaultState = createDefaultPreferenceState()
  getStore().set("preferences", defaultState)
  return defaultState
}
