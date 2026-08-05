import type { AppInfo, AppSettings, ServiceStatus } from "@focus-ui/shared"

type StatusPageProps = {
  appInfo: AppInfo | null
  serviceStatus: ServiceStatus | null
  settings: AppSettings | null
  isServiceActionPending: boolean
  onStartService: () => Promise<void>
  onStopService: () => Promise<void>
  onCopyServiceAddress: () => Promise<void>
}

const StatusPage = ({
  appInfo,
  serviceStatus,
  settings,
  isServiceActionPending,
  onStartService,
  onStopService,
  onCopyServiceAddress
}: StatusPageProps): JSX.Element => {
  const aiConfigured = Boolean(settings?.apiKey.trim() && settings?.modelName.trim())
  const isRunning = serviceStatus?.running ?? false

  return (
    <section className="page-panel">
      <p className="eyebrow">运行状态</p>
      <h2>桌面端状态</h2>
      <p className="page-intro">管理本地服务，并查看当前桌面端的基础连接信息。</p>

      <div className="status-grid">
        <article className="status-card">
          <span>本地服务</span>
          <strong className={isRunning ? "status-good" : "status-muted"}>
            {serviceStatus ? (isRunning ? "运行中" : "已停止") : "读取中"}
          </strong>
          {serviceStatus?.error ? <small>{serviceStatus.error}</small> : null}
        </article>
        <article className="status-card">
          <span>AI配置</span>
          <strong className={aiConfigured ? "status-good" : "status-muted"}>
            {aiConfigured ? "已配置" : "尚未配置"}
          </strong>
        </article>
        <article className="status-card">
          <span>插件状态</span>
          <strong className="status-muted">尚未连接</strong>
        </article>
        <article className="status-card">
          <span>最后连接时间</span>
          <strong className="status-muted">无</strong>
        </article>
      </div>

      <div className="detail-list">
        <div><span>应用版本</span><strong>{appInfo?.version ?? "读取中"}</strong></div>
        <div><span>当前平台</span><strong>{appInfo?.platform ?? "读取中"}</strong></div>
        <div><span>本地服务地址</span><code>{serviceStatus?.address ?? "读取中"}</code></div>
      </div>

      <div className="button-row">
        <button disabled={isRunning || isServiceActionPending} onClick={onStartService} type="button">
          {isServiceActionPending ? "处理中…" : "启动服务"}
        </button>
        <button disabled={!isRunning || isServiceActionPending} onClick={onStopService} type="button">
          {isServiceActionPending ? "处理中…" : "停止服务"}
        </button>
        <button className="secondary" disabled={!serviceStatus} onClick={onCopyServiceAddress} type="button">
          复制服务地址
        </button>
      </div>
    </section>
  )
}

export default StatusPage
