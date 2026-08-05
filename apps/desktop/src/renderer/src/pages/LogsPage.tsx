const LogsPage = (): JSX.Element => {
  return (
    <section className="page-panel">
      <p className="eyebrow">调试日志</p>
      <h2>基础诊断</h2>
      <p className="page-intro">日志系统将在后续模块完善。</p>
      <div className="empty-state">当前模块不会记录 API Key、令牌、完整请求体或网页内容。</div>
    </section>
  )
}

export default LogsPage
