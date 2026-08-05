import { useEffect, useState } from "react"
import type { AppSettings } from "@focus-ui/shared"

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
    setMessage(null)
    try {
      await onSave({ ...settings, apiBaseUrl, apiKey, modelName })
      setMessage("设置已保存。")
    } catch (_error: unknown) {
      setMessage("保存失败，请检查输入后重试。")
    } finally {
      setIsSaving(false)
    }
  }

  const testConnection = (): void => {
    if (!apiKey.trim() || !modelName.trim()) {
      setMessage("请先填写 API Key 和模型名称。")
      return
    }

    setMessage("AI调用将在后续模块接入；当前未发起真实网络请求。")
  }

  return (
    <section className="page-panel">
      <p className="eyebrow">AI设置</p>
      <h2>模型连接配置</h2>
      <p className="page-intro">配置仅保存在本机桌面端，不会发送给浏览器插件。</p>
      <div className="form-grid">
        <label>
          API地址
          <input value={apiBaseUrl} onChange={(event): void => setApiBaseUrl(event.target.value)} />
        </label>
        <label>
          API Key
          <span className="input-with-button">
            <input
              type={isKeyVisible ? "text" : "password"}
              value={apiKey}
              onChange={(event): void => setApiKey(event.target.value)}
            />
            <button className="secondary compact" onClick={(): void => setIsKeyVisible(!isKeyVisible)} type="button">
              {isKeyVisible ? "隐藏" : "显示"}
            </button>
          </span>
        </label>
        <label>
          模型名称
          <input value={modelName} onChange={(event): void => setModelName(event.target.value)} />
        </label>
      </div>
      {message ? <p className="notice">{message}</p> : null}
      <div className="button-row">
        <button disabled={!settings || isSaving} onClick={(): void => void save()} type="button">
          {isSaving ? "保存中…" : "保存设置"}
        </button>
        <button className="secondary" disabled={isSaving} onClick={testConnection} type="button">
          测试连接
        </button>
      </div>
    </section>
  )
}

export default AISettingsPage
