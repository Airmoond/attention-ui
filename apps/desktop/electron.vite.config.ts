import { defineConfig, externalizeDepsPlugin } from "electron-vite"
import react from "@vitejs/plugin-react"

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin({ exclude: ["@attention-ui/shared"] })]
  },
  preload: {
    plugins: [externalizeDepsPlugin({ exclude: ["@attention-ui/shared"] })]
  },
  renderer: {
    plugins: [react()]
  }
})
