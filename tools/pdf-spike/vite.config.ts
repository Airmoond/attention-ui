import { defineConfig } from "vite"
import { randomBytes } from "node:crypto"
import { spawn, type ChildProcess } from "node:child_process"
import { existsSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { z } from "../../node_modules/zod/index.js"

const root = fileURLToPath(new URL(".", import.meta.url))
const python = root + (process.platform === "win32" ? ".formula-runtime/Scripts/python.exe" : ".formula-runtime/bin/python")
const imageSchema = z.string().max(3_000_000).regex(/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/)
const inputSchema = z.object({ images: z.array(imageSchema).min(1).max(12) }).strict()
const outputSchema = z.object({ results: z.array(z.union([
  z.object({ latex: z.string().trim().min(1).max(8000), seconds: z.number().nonnegative() }).strict(),
  z.object({ error: z.literal("RECOGNITION_FAILED") }).strict()
])).min(1).max(12) }).strict()

export default defineConfig({ plugins: [{ name: "local-formula-experiment", configureServer(server) {
  const token = randomBytes(32).toString("hex")
  let active: ChildProcess | null = null
  server.httpServer?.once("close", () => active?.kill())
  server.middlewares.use((req, res, next) => {
    if (!req.url?.startsWith("/__formula/")) return next()
    const send = (status: number, data: unknown): void => {
      if (res.destroyed || res.writableEnded) return
      res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" })
      res.end(JSON.stringify(data))
    }
    const host = req.headers.host ?? ""
    if (!/^(127\.0\.0\.1|localhost):\d+$/.test(host) ||
        (req.headers.origin && req.headers.origin !== "http://" + host) ||
        req.headers["sec-fetch-site"] === "cross-site") return send(403, { error: "ORIGIN_REJECTED" })
    if (req.method === "GET" && req.url === "/__formula/session") {
      return send(200, { token, available: existsSync(python) })
    }
    if (req.method !== "POST" || req.url !== "/__formula/recognize") return send(404, { error: "NOT_FOUND" })
    if (req.headers["x-formula-token"] !== token) return send(401, { error: "UNAUTHORIZED" })
    if (!req.headers["content-type"]?.startsWith("application/json")) return send(415, { error: "INVALID_TYPE" })
    if (active) return send(429, { error: "BUSY" })
    if (!existsSync(python)) return send(503, { error: "MODEL_MISSING" })
    let size = 0
    const chunks: Buffer[] = []
    req.on("data", (chunk: Buffer) => {
      size += chunk.length
      if (size <= 4_000_000) chunks.push(chunk)
      else send(413, { error: "TOO_LARGE" })
    })
    req.on("end", () => {
      if (res.writableEnded || res.destroyed) return
      let input: z.infer<typeof inputSchema>
      try { input = inputSchema.parse(JSON.parse(Buffer.concat(chunks).toString("utf8"))) }
      catch { return send(400, { error: "INVALID_INPUT" }) }
      if (active) return send(429, { error: "BUSY" })
      const child = spawn(python, [root + "formula_worker.py"], { cwd: root, windowsHide: true,
        stdio: ["pipe", "pipe", "ignore"], env: { ...process.env, HF_HUB_OFFLINE: "1", PYTHONIOENCODING: "utf-8" } })
      active = child
      let output = ""
      const timer = setTimeout(() => { child.kill(); send(504, { error: "TIMEOUT" }) }, 90_000)
      child.stdout.on("data", (data: Buffer) => {
        output += data.toString("utf8")
        if (output.length > 120_000) { child.kill(); send(502, { error: "INVALID_RESULT" }) }
      })
      child.stdin.on("error", () => send(503, { error: "WORKER_FAILED" }))
      child.once("error", () => send(503, { error: "WORKER_FAILED" }))
      child.once("close", code => {
        clearTimeout(timer)
        if (active === child) active = null
        if (code !== 0) return send(503, { error: "WORKER_FAILED" })
        try {
          const result = outputSchema.parse(JSON.parse(output))
          if (result.results.length !== input.images.length) throw new Error("RESULT_COUNT")
          send(200, result)
        } catch { send(502, { error: "INVALID_RESULT" }) }
      })
      res.once("close", () => { if (!res.writableEnded) child.kill() })
      child.stdin.end(JSON.stringify(input))
    })
  })
} }] })
