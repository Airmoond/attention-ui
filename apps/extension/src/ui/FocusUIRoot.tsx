import type {
  PageContext,
  ToolId,
  ToolPlan,
  ToolResult
} from "@focus-ui/shared"
import { useEffect, useRef, useState } from "react"
import type { AttentionCandidate } from "../attention/attention-engine"
import {
  sendExtensionMessage,
  type BackgroundMessageResult
} from "../communication/messages"
import {
  extractFocusReaderContent,
  type FocusReaderContent
} from "../context/focus-content-extractor"
import {
  getLocalToolById,
  MAX_LOCAL_TOOLS,
  type LocalTool
} from "../policy/local-policy"
import { AIResultCard } from "./AIResultCard"
import { AskBox } from "./AskBox"
import { AttentionToolbar } from "./AttentionToolbar"
import { ErrorCard } from "./ErrorCard"
import { FocusReader } from "./FocusReader"
import { LoadingCard } from "./LoadingCard"

export type ToolbarSession = {
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
}

export const mergePlannedTool = (tools: LocalTool[], plan: ToolPlan): LocalTool[] => [
  getLocalToolById(plan.toolId),
  ...tools.filter((tool) => tool.id !== plan.toolId)
].slice(0, MAX_LOCAL_TOOLS)

export const getToolRequestErrorMessage = (result: BackgroundMessageResult): string => {
  if (!("ok" in result) || result.ok) {
    return "FocusUI暂时无法处理此操作"
  }

  switch (result.code) {
    case "REQUEST_TIMEOUT":
    case "DESKTOP_UNREACHABLE":
    case "BACKGROUND_UNAVAILABLE":
    case "BACKGROUND_REQUEST_FAILED":
      return "FocusUI Desktop未连接"
    case "MISSING_CLIENT_TOKEN":
    case "INVALID_CLIENT_TOKEN":
      return "尚未与FocusUI Desktop配对"
    default:
      return "FocusUI暂时无法处理此操作"
  }
}

export const FocusUIRoot = ({ session }: FocusUIRootProps): React.JSX.Element | null => {
  const [state, setState] = useState<FocusUIState>(() =>
    session ? { kind: "toolbar", session } : { kind: "idle" }
  )
  const toolbarRef = useRef<HTMLDivElement>(null)
  const requestVersionRef = useRef(0)

  useEffect(() => {
    if (!session) {
      return
    }

    const requestVersion = ++requestVersionRef.current
    setState({ kind: "toolbar", session })
    void sendExtensionMessage({ type: "PLAN_TOOLS", pageContext: session.context }).then((result) => {
      if (requestVersion !== requestVersionRef.current || !("source" in result)) {
        return
      }
      if (result.source !== "ai") {
        return
      }
      const plannedSession: ToolbarSession = {
        ...session,
        tools: mergePlannedTool(session.tools, result.plan)
      }
      setState((current) =>
        current.kind === "toolbar" && current.session === session
          ? { kind: "toolbar", session: plannedSession }
          : current
      )
    })
  }, [session])

  useEffect(() => {
    if (state.kind === "idle") {
      return
    }

    const closeOnEscape = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        requestVersionRef.current += 1
        setState({ kind: "idle" })
      }
    }
    const closeOnOutsidePointer = (event: PointerEvent): void => {
      if (state.kind === "focus-reader") {
        return
      }
      const surface = toolbarRef.current
      if (surface && !event.composedPath().includes(surface)) {
        requestVersionRef.current += 1
        setState({ kind: "idle" })
      }
    }
    const closeOnScroll = (): void => {
      if (state.kind === "toolbar") {
        requestVersionRef.current += 1
        setState({ kind: "idle" })
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
  }, [state.kind])

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
    setState({ kind: "idle" })
  }

  const executeAiTool = async (
    toolId: ToolId,
    currentSession: ToolbarSession,
    question?: string
  ): Promise<void> => {
    const requestVersion = ++requestVersionRef.current
    setState({ kind: "loading", toolId, session: currentSession })
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
      setState(
        result.success
          ? { kind: "result", result, session: currentSession }
          : { kind: "message", message: result.content, session: currentSession }
      )
      return
    }

    setState({
      kind: "message",
      message: getToolRequestErrorMessage(result),
      session: currentSession
    })
  }

  const handleToolSelect = async (toolId: ToolId, currentSession: ToolbarSession): Promise<void> => {
    if (toolId === "focus") {
      const content = extractFocusReaderContent(
        currentSession.candidate.element,
        currentSession.context
      )
      requestVersionRef.current += 1
      setState(
        content
          ? { kind: "focus-reader", content }
          : { kind: "message", message: "未找到可阅读的正文", session: currentSession }
      )
      return
    }

    if (toolId === "ask") {
      requestVersionRef.current += 1
      setState({ kind: "ask", session: currentSession })
      return
    }

    await executeAiTool(toolId, currentSession)
  }

  if (state.kind === "idle") {
    return null
  }

  if (state.kind === "message") {
    return (
      <ErrorCard
        ref={toolbarRef}
        message={state.message}
        onBack={() => {
          requestVersionRef.current += 1
          setState({ kind: "toolbar", session: state.session })
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
            setState({
              kind: "message",
              message: "FocusUI暂时无法处理此操作",
              session: state.session
            })
          })
        }}
        onBack={() => {
          requestVersionRef.current += 1
          setState({ kind: "toolbar", session: state.session })
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
          setState({ kind: "toolbar", session: state.session })
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
          setState({
            kind: "message",
            message: "FocusUI暂时无法处理此操作",
            session: currentSession
          })
        })
      }}
    />
  )
}
