import { useEffect, useState } from "react"
import type { AppSettings } from "@attention-ui/shared"

type AISettingsPageProps = {
  settings: AppSettings | null
  onSave: (settings: AppSettings) => Promise<void>
}

const AISettingsPage = ({ settings, onSave }: AISettingsPageProps): JSX.Element => {
  const [apiBaseUrl, setApiBaseUrl] = useState("")
  const [apiKey, setApiKey] = useState("")
  const [modelName, setModelName] = useState("")
  const [isKeyVisible, setIsKeyVisible] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [pendingAction, setPendingAction] = useState<"save" | "test" | null>(null)
  const [messageKind, setMessageKind] = useState<"success" | "error">("success")
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    if (settings) {
      setApiBaseUrl(settings.apiBaseUrl)
      setApiKey(settings.apiKey)
      setModelName(settings.modelName)
    }
  }, [settings])

  const save = async (): Promise<void> => {
    if (!settings) {
      return
    }

    setIsSaving(true)
    setPendingAction("save")
    setMessage(null)
    try {
      await onSave({ ...settings, apiBaseUrl, apiKey, modelName })
      setMessage("设置已保存。")
      setMessageKind("success")
    } catch (_error: unknown) {
      setMessage("保存失败，请检查输入后重试。")
      setMessageKind("error")
    } finally {
      setIsSaving(false)
      setPendingAction(null)
    }
  }

  const testConnection = async (): Promise<void> => {
    if (!settings || !apiBaseUrl.trim() || !apiKey.trim() || !modelName.trim()) {
      setMessage("请先填写 API 地址、API Key 和模型名称。")
      setMessageKind("error")
      return
    }

    setIsSaving(true)
    setPendingAction("test")
    setMessage(null)
    try {
      const result = await window.attentionUI.testAiConnection({
        ...settings,
        apiBaseUrl,
        apiKey,
        modelName
      })
      setMessage(result.message)
      setMessageKind(result.ok ? "success" : "error")
    } catch (_error: unknown) {
      setMessage("AI服务连接失败")
      setMessageKind("error")
    } finally {
      setIsSaving(false)
      setPendingAction(null)
    }
  }

  return (
    <section className="page-panel">
      <p className="eyebrow">AI设置</p>
      <h2>模型连接配置</h2>
      <p className="page-intro">配置仅保存在本机桌面端，不会发送给浏览器插件。</p>
      <div className="settings-group"><div className="group-heading"><h3>连接信息</h3><span>兼容 OpenAI 接口</span></div><div className="form-grid ai-form">
        <label>
          API地址
          <input type="url" placeholder="https://api.example.com/v1" spellCheck={false} autoComplete="off" value={apiBaseUrl} onChange={(event): void => setApiBaseUrl(event.target.value)} aria-describedby="api-address-hint" />
          <small id="api-address-hint">填写服务商提供的 Base URL。</small>
        </label>
        <label>
          API Key
          <span className="input-with-button">
            <input
              type={isKeyVisible ? "text" : "password"}
              autoComplete="off"
              spellCheck={false}
              placeholder="输入你的 API Key"
              value={apiKey}
              onChange={(event): void => setApiKey(event.target.value)}
            />
            <button aria-pressed={isKeyVisible} className="secondary compact" onClick={(): void => setIsKeyVisible(!isKeyVisible)} type="button">
              {isKeyVisible ? "隐藏" : "显示"}
            </button>
          </span>
        </label>
        <label>
          模型名称
          <input spellCheck={false} placeholder="填写模型名称" value={modelName} onChange={(event): void => setModelName(event.target.value)} />
          <small>与服务商提供的模型标识保持一致。</small>
        </label>
      </div></div>
      <p className="privacy-note"><span aria-hidden="true">◇</span> 密钥保存在本机，阅读工具仅发送所需片段。</p>
      {message ? <p role="status" className={`notice ${messageKind}`}>{message}</p> : null}
      <div className="button-row">
        <button disabled={!settings || isSaving} onClick={(): void => void save()} type="button">
          {pendingAction === "save" ? "保存中…" : "保存设置"}
        </button>
        <button className="secondary" disabled={isSaving} onClick={(): void => void testConnection()} type="button">
          {pendingAction === "test" ? "测试中…" : "测试连接"}
        </button>
      </div>
    </section>
  )
}

export default AISettingsPage
