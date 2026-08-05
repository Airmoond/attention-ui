import { createRoot } from "react-dom/client"
import { App } from "./App"

const rootElement = document.getElementById("root")

if (!rootElement) {
  throw new Error("FocusUI Popup 根节点不存在")
}

createRoot(rootElement).render(<App />)
