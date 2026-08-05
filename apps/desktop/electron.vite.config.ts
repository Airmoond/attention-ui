import { defineConfig, externalizeDepsPlugin } from "electron-vite"
import react from "@vitejs/plugin-react"

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin({ exclude: ["@focus-ui/shared"] })]
  },
  preload: {
    plugins: [externalizeDepsPlugin({ exclude: ["@focus-ui/shared"] })]
  },
  renderer: {
    plugins: [react()]
  }
})
