import {
  getFocusUIErrorMessage,
  type ContextKind,
  type PageContext,
  type ToolId,
  type ToolPlan,
  type ToolResult
} from "@focus-ui/shared"
import { useCallback, useEffect, useRef, useState } from "react"
import type { AttentionCandidate } from "../attention/attention-engine"
import { sendExtensionMessage } from "../communication/messages"
import {
  extractFocusReaderContent,
  type FocusReaderContent
} from "../context/focus-content-extractor"
import {
  getLocalToolById,
  MAX_LOCAL_TOOLS,
  type LocalTool
} from "../policy/local-policy"
import { sortToolsByPreference } from "../policy/habit-sorter"
import { AIResultCard } from "./AIResultCard"
import { AskBox } from "./AskBox"
import { AttentionToolbar } from "./AttentionToolbar"
import { ErrorCard } from "./ErrorCard"
import { FocusReader } from "./FocusReader"
import { LoadingCard } from "./LoadingCard"
import {
  getToolRequestErrorCode,
  getToolRequestErrorMessage,
  isRetryableFocusUIError
} from "./error-messages"

export { getToolRequestErrorMessage } from "./error-messages"

export type ToolbarSession = {
  trigger?: "hover" | "manual"
  candidate: AttentionCandidate
  context: PageContext
  tools: LocalTool[]
}

type FocusUIState =
  | { kind: "idle" }
  | {
      kind: "toolbar"
      session: ToolbarSession
    }
  | {
      kind: "message"
      message: string
      session: ToolbarSession
      retry?: { toolId: ToolId; question?: string }
    }
  | {
      kind: "loading"
      toolId: ToolId
      session: ToolbarSession
    }
  | {
      kind: "ask"
      session: ToolbarSession
    }
  | {
      kind: "result"
      result: ToolResult
      session: ToolbarSession
    }
  | {
      kind: "focus-reader"
      content: FocusReaderContent
    }

export type FocusUIRootProps = {
  session: ToolbarSession | null
  autoAI?: boolean
}

export const mergePlannedTool = (tools: LocalTool[], plan: ToolPlan): LocalTool[] => {
  if (!tools.some((tool) => tool.id === plan.toolId)) {
    return tools.map((tool) => ({ ...tool }))
  }
  return [
    getLocalToolById(plan.toolId),
    ...tools.filter((tool) => tool.id !== plan.toolId)
  ].slice(0, MAX_LOCAL_TOOLS)
}

export const recordToolClick = (
  toolId: ToolId,
  contextType: ContextKind,
  sendMessage: typeof sendExtensionMessage = sendExtensionMessage
): void => {
  void sendMessage({
    type: "RECORD_TOOL_EVENT",
    event: { eventType: "tool_clicked", contextType, toolId }
  })
    .then((result) => {
      if ("ok" in result && !result.ok && import.meta.env.DEV) {
        console.warn("FocusUI 工具使用记录失败", result.code)
      }
    })
    .catch((_error: unknown) => {
      if (import.meta.env.DEV) {
        console.warn("FocusUI 工具使用记录失败")
      }
    })
}

export const FocusUIRoot = ({ session, autoAI = false }: FocusUIRootProps): React.JSX.Element | null => {
  const [state, setState] = useState<FocusUIState>(() =>
    session ? { kind: "toolbar", session } : { kind: "idle" }
  )
  const stateRef = useRef(state)
  // Event handlers must claim the interaction before a pending hover effect runs.
  const updateState = useCallback((next: FocusUIState): void => {
    stateRef.current = next
    setState(next)
  }, [])
  const toolbarRef = useRef<HTMLDivElement>(null)
  const requestVersionRef = useRef(0)

  useEffect(() => () => { requestVersionRef.current += 1 }, [])

  useEffect(() => {
    if (!session) {
      return
    }
    const current = stateRef.current
    if (session.trigger !== "manual" && current.kind !== "idle" && current.kind !== "toolbar") {
      return
    }

    const requestVersion = ++requestVersionRef.current
    updateState({ kind: "toolbar", session })
    void Promise.all([
      autoAI ? sendExtensionMessage({ type: "PLAN_TOOLS", pageContext: session.context }) : Promise.resolve(null),
      sendExtensionMessage({ type: "GET_PREFERENCES" })
    ]).then(([planResult, preferencesResult]) => {
      if (requestVersion !== requestVersionRef.current) {
        return
      }

      const plannedTools =
        planResult && "source" in planResult && planResult.source === "ai"
          ? mergePlannedTool(session.tools, planResult.plan)
          : session.tools
      const finalTools =
        "preferences" in preferencesResult
          ? sortToolsByPreference(
              plannedTools,
              session.context.contextKind,
              preferencesResult.preferences
            )
          : plannedTools
      const plannedSession: ToolbarSession = { ...session, tools: finalTools }
      const current = stateRef.current
      if (current.kind === "toolbar" && current.session === session) {
        updateState({ kind: "toolbar", session: plannedSession })
      }
    })
    // Only accepted sessions/actions invalidate requests; ignored hovers must not.
  }, [session, autoAI, updateState])

  useEffect(() => {
    if (state.kind === "idle") {
      return
    }

    const closeOnEscape = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        requestVersionRef.current += 1
        updateState({ kind: "idle" })
      }
    }
    const closeOnOutsidePointer = (event: PointerEvent): void => {
      if (state.kind === "focus-reader") {
        return
      }
      const surface = toolbarRef.current
      if (surface && !event.composedPath().includes(surface)) {
        requestVersionRef.current += 1
        updateState({ kind: "idle" })
      }
    }
    const closeOnScroll = (): void => {
      if (state.kind === "toolbar") {
        requestVersionRef.current += 1
        updateState({ kind: "idle" })
      }
    }

    document.addEventListener("keydown", closeOnEscape)
    document.addEventListener("pointerdown", closeOnOutsidePointer, true)
    window.addEventListener("scroll", closeOnScroll, { capture: true, passive: true })
    return () => {
      document.removeEventListener("keydown", closeOnEscape)
      document.removeEventListener("pointerdown", closeOnOutsidePointer, true)
      window.removeEventListener("scroll", closeOnScroll, true)
    }
  }, [state.kind, updateState])

  useEffect(() => {
    if (state.kind !== "focus-reader") {
      return
    }

    const rootStyle = document.documentElement.style
    const bodyStyle = document.body?.style ?? null
    const rootOverflow = {
      value: rootStyle.getPropertyValue("overflow"),
      priority: rootStyle.getPropertyPriority("overflow")
    }
    const bodyOverflow = bodyStyle
      ? {
          value: bodyStyle.getPropertyValue("overflow"),
          priority: bodyStyle.getPropertyPriority("overflow")
        }
      : null

    rootStyle.setProperty("overflow", "hidden", "important")
    bodyStyle?.setProperty("overflow", "hidden", "important")
    return () => {
      if (rootOverflow.value) {
        rootStyle.setProperty("overflow", rootOverflow.value, rootOverflow.priority)
      } else {
        rootStyle.removeProperty("overflow")
      }
      if (bodyStyle && bodyOverflow) {
        if (bodyOverflow.value) {
          bodyStyle.setProperty("overflow", bodyOverflow.value, bodyOverflow.priority)
        } else {
          bodyStyle.removeProperty("overflow")
        }
      }
    }
  }, [state.kind])

  const dismiss = (): void => {
    requestVersionRef.current += 1
    updateState({ kind: "idle" })
  }

  const executeAiTool = async (
    toolId: ToolId,
    currentSession: ToolbarSession,
    question?: string
  ): Promise<void> => {
    const requestVersion = ++requestVersionRef.current
    updateState({ kind: "loading", toolId, session: currentSession })
    const result = await sendExtensionMessage({
      type: "EXECUTE_TOOL",
      request: {
        toolId,
        pageContext: currentSession.context,
        ...(question ? { question } : {})
      }
    })
    if (requestVersion !== requestVersionRef.current) {
      return
    }

    if ("toolId" in result && "success" in result && result.toolId === toolId) {
      const errorCode = result.success ? null : getToolRequestErrorCode(result)
      updateState(
        result.success
          ? { kind: "result", result, session: currentSession }
          : {
              kind: "message",
              message: getFocusUIErrorMessage(errorCode ?? "UNKNOWN_ERROR"),
              session: currentSession,
              ...(errorCode && isRetryableFocusUIError(errorCode)
                ? { retry: { toolId, ...(question ? { question } : {}) } }
                : {})
            }
      )
      return
    }

    const errorCode = getToolRequestErrorCode(result)
    updateState({
      kind: "message",
      message: getToolRequestErrorMessage(result),
      session: currentSession,
      ...(isRetryableFocusUIError(errorCode)
        ? { retry: { toolId, ...(question ? { question } : {}) } }
        : {})
    })
  }

  const handleToolSelect = async (toolId: ToolId, currentSession: ToolbarSession): Promise<void> => {
    recordToolClick(toolId, currentSession.context.contextKind)

    if (toolId === "focus") {
      const content = extractFocusReaderContent(
        currentSession.candidate.element,
        currentSession.context
      )
      requestVersionRef.current += 1
      updateState(
        content
          ? { kind: "focus-reader", content }
          : { kind: "message", message: "未找到可阅读的正文", session: currentSession }
      )
      return
    }

    if (toolId === "ask") {
      requestVersionRef.current += 1
      updateState({ kind: "ask", session: currentSession })
      return
    }

    await executeAiTool(toolId, currentSession)
  }

  if (state.kind === "idle") {
    return null
  }

  if (state.kind === "message") {
    const retry = state.retry
    return (
      <ErrorCard
        ref={toolbarRef}
        message={state.message}
        onRetry={
          retry
            ? () => {
                void executeAiTool(retry.toolId, state.session, retry.question)
              }
            : undefined
        }
        onBack={() => {
          requestVersionRef.current += 1
          updateState({ kind: "toolbar", session: state.session })
        }}
        onClose={dismiss}
      />
    )
  }

  if (state.kind === "loading") {
    return <LoadingCard ref={toolbarRef} toolId={state.toolId} onClose={dismiss} />
  }

  if (state.kind === "ask") {
    return (
      <AskBox
        ref={toolbarRef}
        onSubmit={(question) => {
          void executeAiTool("ask", state.session, question).catch((_error: unknown) => {
            requestVersionRef.current += 1
            updateState({
              kind: "message",
              message: getFocusUIErrorMessage("UNKNOWN_ERROR"),
              session: state.session,
              retry: { toolId: "ask", question }
            })
          })
        }}
        onBack={() => {
          requestVersionRef.current += 1
          updateState({ kind: "toolbar", session: state.session })
        }}
        onClose={dismiss}
      />
    )
  }

  if (state.kind === "result") {
    return (
      <AIResultCard
        ref={toolbarRef}
        result={state.result}
        onBack={() => {
          requestVersionRef.current += 1
          updateState({ kind: "toolbar", session: state.session })
        }}
        onClose={dismiss}
      />
    )
  }

  if (state.kind === "focus-reader") {
    return <FocusReader content={state.content} onClose={dismiss} />
  }

  return (
    <AttentionToolbar
      ref={toolbarRef}
      candidate={state.session.candidate}
      tools={state.session.tools}
      onClose={dismiss}
      onToolSelect={(tool) => {
        const currentSession = state.session
        void handleToolSelect(tool.id, currentSession).catch((_error: unknown) => {
          requestVersionRef.current += 1
          updateState({
            kind: "message",
            message: getFocusUIErrorMessage("UNKNOWN_ERROR"),
            session: currentSession,
            retry: { toolId: tool.id }
          })
        })
      }}
    />
  )
}
