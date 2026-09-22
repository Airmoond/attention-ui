import { defineConfig } from "wxt"

export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  vite: () => ({
    build: {
      modulePreload: false
    }
  }),
  manifest: {
    name: "FocusUI 0.1.0 Beta",
    version_name: "0.1.0 Beta",
    description: "根据当前关注内容提供总结、解释、提问、图表、提取与专注阅读工具",
    permissions: ["storage", "activeTab", "scripting"],
    host_permissions: [
      "http://127.0.0.1:17321/*",
      "http://localhost:17321/*",
      "http://127.0.0.1:8080/*",
      "http://localhost:8080/*",
      "https://en.wikipedia.org/*"
    ]
  }
})
