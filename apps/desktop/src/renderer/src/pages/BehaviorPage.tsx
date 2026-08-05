import { useEffect, useState } from "react"
import type { AppSettings } from "@focus-ui/shared"

type BehaviorPageProps = {
  settings: AppSettings | null
  onSave: (settings: AppSettings) => Promise<void>
}

const BehaviorPage = ({ settings, onSave }: BehaviorPageProps): JSX.Element => {
  const [draft, setDraft] = useState<AppSettings | null>(settings)
  const [delay, setDelay] = useState(settings?.attentionDelayMs.toString() ?? "900")
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    setDraft(settings)
    setDelay(settings?.attentionDelayMs.toString() ?? "900")
  }, [settings])

  const save = async (): Promise<void> => {
    if (!draft) {
      return
    }

    const attentionDelayMs = Number(delay)
    if (!Number.isInteger(attentionDelayMs) || attentionDelayMs < 300 || attentionDelayMs > 3000) {
      setMessage("鼠标停留时间必须是 300 至 3000 毫秒之间的整数。")
      return
    }

    setIsSaving(true)
    setMessage(null)
    try {
      const nextSettings = { ...draft, attentionDelayMs }
      await onSave(nextSettings)
      setDraft(nextSettings)
      setMessage("交互设置已保存。")
    } catch (_error: unknown) {
      setMessage("保存失败，请稍后重试。")
    } finally {
      setIsSaving(false)
    }
  }

  const updateBoolean = (key: keyof Pick<AppSettings, "enableAI" | "enableLocalTools" | "enableFocusMode" | "enableHabitLearning">, value: boolean): void => {
    setDraft((current) => (current ? { ...current, [key]: value } : current))
  }

  return (
    <section className="page-panel">
      <p className="eyebrow">交互设置</p>
      <h2>关注与本地功能</h2>
      <p className="page-intro">这些设置将影响未来插件中的本地交互行为。</p>
      <div className="form-grid">
        <label>
          鼠标停留时间（毫秒）
          <input
            max="3000"
            min="300"
            type="number"
            value={delay}
            onChange={(event): void => setDelay(event.target.value)}
          />
        </label>
      </div>
      <div className="toggle-list">
        <label><input checked={draft?.enableAI ?? false} onChange={(event): void => updateBoolean("enableAI", event.target.checked)} type="checkbox" /> 启用AI推荐</label>
        <label><input checked={draft?.enableLocalTools ?? false} onChange={(event): void => updateBoolean("enableLocalTools", event.target.checked)} type="checkbox" /> 启用本地工具</label>
        <label><input checked={draft?.enableFocusMode ?? false} onChange={(event): void => updateBoolean("enableFocusMode", event.target.checked)} type="checkbox" /> 启用专注模式</label>
        <label><input checked={draft?.enableHabitLearning ?? false} onChange={(event): void => updateBoolean("enableHabitLearning", event.target.checked)} type="checkbox" /> 启用习惯学习</label>
      </div>
      {message ? <p className="notice">{message}</p> : null}
      <div className="button-row">
        <button disabled={!draft || isSaving} onClick={(): void => void save()} type="button">{isSaving ? "保存中…" : "保存交互设置"}</button>
        <button className="secondary" onClick={(): void => setMessage("习惯学习功能将在后续模块接入。")} type="button">清除习惯数据</button>
      </div>
    </section>
  )
}

export default BehaviorPage
