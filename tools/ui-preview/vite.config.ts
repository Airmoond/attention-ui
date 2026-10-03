import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import { resolve } from "node:path"

export default defineConfig({
  root: __dirname,
  plugins: [react()],
  resolve: {
    // Preview all real components using a single React runtime.
    alias: {
      react: resolve(__dirname, "../../node_modules/react"),
      "react-dom": resolve(__dirname, "../../node_modules/react-dom")
    }
  },
  server: { host: "127.0.0.1", port: 5190, strictPort: true, fs: { allow: [resolve(__dirname, "../..")] } },
  build: { outDir: "dist", emptyOutDir: true }
})
