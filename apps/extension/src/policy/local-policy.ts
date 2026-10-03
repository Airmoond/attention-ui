import type { ContextKind, PageContext, ToolId } from "@attention-ui/shared"

export type LocalTool = {
  id: ToolId
  label: string
  availableOffline: boolean
}

export type LocalPolicyOptions = {
  isLongFormEnvironment?: boolean
}

export const LONG_FORM_TEXT_LENGTH = 600
export const MAX_LOCAL_TOOLS = 3

const TOOL_CATALOG: Readonly<Record<ToolId, LocalTool>> = {
  summarize: { id: "summarize", label: "总结", availableOffline: false },
  explain: { id: "explain", label: "解释", availableOffline: false },
  ask: { id: "ask", label: "提问", availableOffline: false },
  chart: { id: "chart", label: "生成图表", availableOffline: false },
  extract: { id: "extract", label: "提取数据", availableOffline: false },
  focus: { id: "focus", label: "专注", availableOffline: true }
}

export const getLocalToolById = (toolId: ToolId): LocalTool => ({
  ...TOOL_CATALOG[toolId]
})

const DEFAULT_TOOL_IDS = {
  text: ["summarize", "explain", "ask"],
  numbers: ["chart", "explain", "extract"],
  table: ["chart", "extract", "summarize"],
  code: ["explain", "ask"],
  unknown: ["summarize", "ask"]
} as const satisfies Readonly<Record<ContextKind, readonly ToolId[]>>

const LONG_FORM_TOOL_IDS = ["focus", "summarize", "explain"] as const satisfies readonly ToolId[]

export const getLocalTools = (
  pageContext: PageContext,
  options: LocalPolicyOptions = {}
): LocalTool[] => {
  const isLongForm =
    pageContext.contextKind === "text" &&
    (pageContext.text.length >= LONG_FORM_TEXT_LENGTH || options.isLongFormEnvironment === true)
  const toolIds = isLongForm ? LONG_FORM_TOOL_IDS : DEFAULT_TOOL_IDS[pageContext.contextKind]

  return toolIds.slice(0, MAX_LOCAL_TOOLS).map((id) => ({ ...TOOL_CATALOG[id] }))
}
