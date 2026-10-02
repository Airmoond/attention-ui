import { defineConfig } from "wxt"

export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  vite: () => ({
    build: {
      modulePreload: false
    }
  }),
  manifest: {
    name: "FocusUI 0.1.1 学生测试版",
    version_name: "0.1.1 学生测试版",
    description: "根据当前关注内容提供总结、解释、提问、图表、提取与专注阅读工具",
    permissions: ["storage", "activeTab", "scripting"],
    optional_host_permissions: ["https://en.wikipedia.org/*", "https://zh.wikipedia.org/*", "https://baike.baidu.com/*",
      "http://127.0.0.1:8080/*", "http://localhost:8080/*"],
    host_permissions: [
      "http://127.0.0.1:17321/*",
      "http://localhost:17321/*"
    ]
  }
})
