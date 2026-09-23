import { cp, mkdir } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import path from "node:path"
const root = path.dirname(fileURLToPath(import.meta.url))
for (const directory of ["cmaps", "standard_fonts", "wasm"]) {
  await mkdir(path.join(root, "public", "pdf-assets"), { recursive: true })
  await cp(path.join(root, "node_modules", "pdfjs-dist", directory), path.join(root, "public", "pdf-assets", directory), { recursive: true })
}
console.log("PDF rendering resources copied locally.")
