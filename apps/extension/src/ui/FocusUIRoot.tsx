import type { PageContext, ToolId } from "@focus-ui/shared"
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
import type { LocalTool } from "../policy/local-policy"
import { AttentionToolbar } from "./AttentionToolbar"
import { ErrorCard } from "./ErrorCard"
import { FocusReader } from "./FocusReader"

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
      kind: "focus-reader"
      content: FocusReaderContent
    }

export type FocusUIRootProps = {
  session: ToolbarSession | null
}

export const getAiToolFallbackMessage = (result: BackgroundMessageResult): string => {
  if (!result.ok || !("connectionStatus" in result)) {
    return "FocusUI Desktop未连接"
  }

  switch (result.connectionStatus) {
    case "offline":
    case "unknown":
      return "FocusUI Desktop未连接"
    case "online_unpaired":
    case "auth_expired":
      return "尚未与FocusUI Desktop配对"
    case "online_paired":
      return result.health?.aiConfigured
        ? "该AI功能将在下一模块接入"
        : "请先在桌面端配置AI服务"
  }
}

export const FocusUIRoot = ({ session }: FocusUIRootProps): React.JSX.Element | null => {
  const [state, setState] = useState<FocusUIState>(() =>
    session ? { kind: "toolbar", session } : { kind: "idle" }
  )
  const toolbarRef = useRef<HTMLDivElement>(null)
  const requestVersionRef = useRef(0)

  useEffect(() => {
    if (session) {
      requestVersionRef.current += 1
      setState({ kind: "toolbar", session })
    }
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

    const requestVersion = ++requestVersionRef.current
    setState({ kind: "message", message: "正在检查FocusUI Desktop…", session: currentSession })
    try {
      const result = await sendExtensionMessage({ type: "GET_CONNECTION_STATUS" })
      if (requestVersion === requestVersionRef.current) {
        setState({ kind: "message", message: getAiToolFallbackMessage(result), session: currentSession })
      }
    } catch (_error: unknown) {
      if (requestVersion === requestVersionRef.current) {
        setState({ kind: "message", message: "FocusUI Desktop未连接", session: currentSession })
      }
    }
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
