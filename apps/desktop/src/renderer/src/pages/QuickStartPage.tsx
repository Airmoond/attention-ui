import { useState } from "react"
import type {
  AppInfo,
  OnboardingActionResult,
  PairingStatus,
  ServiceStatus
} from "@focus-ui/shared"

type QuickStartPageProps = {
  appInfo: AppInfo | null
  serviceStatus: ServiceStatus | null
  pairingStatus: PairingStatus | null
  onOpenGuide: () => Promise<OnboardingActionResult>
  onPrepareExtension: () => Promise<OnboardingActionResult>
  onOpenArticleDemo: () => Promise<OnboardingActionResult>
  onOpenFinanceDemo: () => Promise<OnboardingActionResult>
  onCopyPairingToken: () => Promise<void>
  onOpenAiSettings: () => void
}

const QuickStartPage = ({
  appInfo,
  serviceStatus,
  pairingStatus,
  onOpenGuide,
  onPrepareExtension,
  onOpenArticleDemo,
  onOpenFinanceDemo,
  onCopyPairingToken,
  onOpenAiSettings
}: QuickStartPageProps): JSX.Element => {
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [actionFailed, setActionFailed] = useState(false)

  const runAction = async (action: () => Promise<OnboardingActionResult>): Promise<void> => {
    const result = await action()
    setActionFailed(!result.ok)
    setActionMessage(result.message)
  }

  return (
    <section className="page-panel quick-start-page">
      <p className="eyebrow">FOCUSUI 0.1.0 BETA</p>
      <h2>5分钟快速上手</h2>
      <p className="page-intro">
        不需要命令行。按照下面四步完成Chrome插件、配对、AI配置和演示体验。
      </p>

      <div className="onboarding-summary">
        <span className={serviceStatus?.running ? "ready" : "pending"}>
          ① Desktop {serviceStatus?.running ? "已运行" : "未运行"}
        </span>
        <span className={pairingStatus?.paired ? "ready" : "pending"}>
          ② 插件 {pairingStatus?.paired ? "已配对" : "待配对"}
        </span>
        <span>版本 {appInfo?.version ?? "0.1.0"} Beta</span>
      </div>

      {actionMessage ? (
        <p className={actionFailed ? "notice error onboarding-notice" : "notice onboarding-notice"}>
          {actionMessage}
        </p>
      ) : null}

      <div className="onboarding-steps">
        <article className="onboarding-step">
          <span className="step-number">1</span>
          <div>
            <h3>安装Chrome插件</h3>
            <p>点击下面按钮会打开内置插件文件夹，并自动复制文件夹路径。</p>
            <ol>
              <li>在Chrome地址栏输入 <code>chrome://extensions</code></li>
              <li>打开右上角“开发者模式”</li>
              <li>点击“加载已解压的扩展程序”</li>
              <li>在文件夹窗口粘贴刚才复制的路径并选择该文件夹</li>
            </ol>
            <button onClick={(): void => { void runAction(onPrepareExtension) }} type="button">
              打开插件文件夹并复制路径
            </button>
          </div>
        </article>

        <article className="onboarding-step">
          <span className="step-number">2</span>
          <div>
            <h3>连接Desktop</h3>
            <p>复制下面的配对令牌，在Chrome插件的“选项”页面粘贴并连接。</p>
            <code className="compact-token">{pairingStatus?.pairingToken ?? "正在读取…"}</code>
            <div className="button-row compact-row">
              <button
                className="secondary"
                disabled={!pairingStatus}
                onClick={(): void => { void onCopyPairingToken() }}
                type="button"
              >
                复制配对令牌
              </button>
            </div>
          </div>
        </article>

        <article className="onboarding-step">
          <span className="step-number">3</span>
          <div>
            <h3>配置AI</h3>
            <p>准备好服务商提供的Base URL、API Key和模型名称，然后测试连接并保存。</p>
            <button className="secondary" onClick={onOpenAiSettings} type="button">
              前往AI设置
            </button>
          </div>
        </article>

        <article className="onboarding-step">
          <span className="step-number">4</span>
          <div>
            <h3>打开演示网页</h3>
            <p>两个网页随安装包提供，由Desktop本地打开，不需要Python或互联网。</p>
            <div className="button-row compact-row">
              <button onClick={(): void => { void runAction(onOpenArticleDemo) }} type="button">
                打开文章Demo
              </button>
              <button onClick={(): void => { void runAction(onOpenFinanceDemo) }} type="button">
                打开财经Demo
              </button>
            </div>
          </div>
        </article>
      </div>

      <div className="guide-footer">
        <div>
          <h3>需要更详细的说明？</h3>
          <p>完整说明书包含安装、插件加载、配对、AI配置、演示操作和常见问题。</p>
        </div>
        <button className="secondary" onClick={(): void => { void runAction(onOpenGuide) }} type="button">
          打开完整说明书
        </button>
      </div>
    </section>
  )
}

export default QuickStartPage
