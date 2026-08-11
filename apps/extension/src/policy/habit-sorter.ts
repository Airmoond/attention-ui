import type { ContextKind, PreferenceState, ToolId } from "@focus-ui/shared"
import type { LocalTool } from "./local-policy"

export const HABIT_ADAPTATION_THRESHOLD = 3
export const CONTEXT_SCORE_WEIGHT = 0.7
export const GLOBAL_SCORE_WEIGHT = 0.3

export const getPreferenceScore = (
  toolId: ToolId,
  contextKind: ContextKind,
  preferences: PreferenceState
): number =>
  (preferences.contextToolCount[contextKind]?.[toolId] ?? 0) * CONTEXT_SCORE_WEIGHT +
  (preferences.globalToolCount[toolId] ?? 0) * GLOBAL_SCORE_WEIGHT

export const sortToolsByPreference = (
  tools: readonly LocalTool[],
  contextKind: ContextKind,
  preferences: PreferenceState
): LocalTool[] => {
  const sortedTools = tools.map((tool) => ({ ...tool }))
  if (sortedTools.length < 2) {
    return sortedTools
  }

  const contextCounts = preferences.contextToolCount[contextKind] ?? {}
  const pinnedTools = new Set(preferences.pinnedTools)
  const candidates = sortedTools
    .map((tool, index) => ({
      index,
      pinned: pinnedTools.has(tool.id),
      contextCount: contextCounts[tool.id] ?? 0,
      score: getPreferenceScore(tool.id, contextKind, preferences)
    }))
    .filter(
      (candidate) =>
        candidate.index > 0 &&
        (candidate.pinned || candidate.contextCount >= HABIT_ADAPTATION_THRESHOLD)
    )
    .filter((candidate) => {
      const previousTool = sortedTools[candidate.index - 1]
      if (!previousTool) {
        return false
      }
      return (
        candidate.pinned ||
        candidate.score > getPreferenceScore(previousTool.id, contextKind, preferences)
      )
    })
    .sort((left, right) => {
      if (left.pinned !== right.pinned) {
        return left.pinned ? -1 : 1
      }
      return right.score - left.score || left.index - right.index
    })

  const candidate = candidates[0]
  if (!candidate) {
    return sortedTools
  }

  const previousTool = sortedTools[candidate.index - 1]
  const preferredTool = sortedTools[candidate.index]
  if (!previousTool || !preferredTool) {
    return sortedTools
  }
  sortedTools[candidate.index - 1] = preferredTool
  sortedTools[candidate.index] = previousTool
  return sortedTools
}
