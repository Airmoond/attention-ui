import type { AppInfo, AppSettings, PairingStatus, ServiceStatus } from "@attention-ui/shared"

type StatusPageProps = {
  appInfo: AppInfo | null
  serviceStatus: ServiceStatus | null
  settings: AppSettings | null
  pairingStatus: PairingStatus | null
  isServiceActionPending: boolean
  onStartService: () => Promise<void>
  onStopService: () => Promise<void>
  onCopyServiceAddress: () => Promise<void>
  onCopyPairingToken: () => Promise<void>
  onRegeneratePairingToken: () => Promise<void>
  onDisconnectPlugin: () => Promise<void>
}

const StatusPage = ({
  appInfo,
  serviceStatus,
  settings,
  pairingStatus,
  isServiceActionPending,
  onStartService,
  onStopService,
  onCopyServiceAddress,
  onCopyPairingToken,
  onRegeneratePairingToken,
  onDisconnectPlugin
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
          <strong className={pairingStatus?.paired ? "status-good" : "status-muted"}>
            {pairingStatus?.paired ? "已配对" : "尚未连接"}
          </strong>
        </article>
        <article className="status-card">
          <span>最后连接时间</span>
          <strong className="status-muted">
            {pairingStatus?.lastConnectedAt
              ? new Date(pairingStatus.lastConnectedAt).toLocaleString()
              : "无"}
          </strong>
        </article>
      </div>

      <div className="detail-list">
        <div><span>应用版本</span><strong>{appInfo ? `${appInfo.version} 学生测试版` : "读取中"}</strong></div>
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

      <section className="pairing-section">
        <h3>插件配对</h3>
        <p>将此令牌复制到后续浏览器插件中。客户端令牌不会在桌面端显示。</p>
        <code className="pairing-token">{pairingStatus?.pairingToken ?? "读取中"}</code>
        <div className="button-row">
          <button className="secondary" disabled={!pairingStatus} onClick={onCopyPairingToken} type="button">复制配对令牌</button>
          <button className="secondary" disabled={!pairingStatus} onClick={onRegeneratePairingToken} type="button">重新生成配对令牌</button>
          <button className="secondary" disabled={!pairingStatus?.paired} onClick={onDisconnectPlugin} type="button">断开插件</button>
        </div>
      </section>
    </section>
  )
}

export default StatusPage
