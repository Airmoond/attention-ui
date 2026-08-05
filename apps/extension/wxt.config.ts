import { defineConfig } from "wxt"

export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  manifest: {
    name: "FocusUI",
    description: "FocusUI 浏览器插件基础功能",
    permissions: ["storage", "activeTab", "scripting"],
    host_permissions: [
      "http://127.0.0.1:17321/*",
      "http://localhost:17321/*",
      "https://en.wikipedia.org/*",
      "file:///*"
    ]
  }
})
