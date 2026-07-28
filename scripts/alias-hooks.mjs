import { existsSync } from "node:fs"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

// Teaches `node --test` the "@/*" path alias from tsconfig.json so test files
// can import application modules exactly the way the app does.

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const extensions = [".ts", ".tsx", ".mjs", ".js", ".json"]

function resolveAliased(specifier) {
  const base = path.join(root, specifier.slice(2))
  if (path.extname(base) && existsSync(base)) return base
  for (const ext of extensions) {
    if (existsSync(base + ext)) return base + ext
  }
  for (const ext of extensions) {
    const indexed = path.join(base, `index${ext}`)
    if (existsSync(indexed)) return indexed
  }
  return null
}

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    const target = resolveAliased(specifier)
    if (target) return nextResolve(pathToFileURL(target).href, context)
  }
  return nextResolve(specifier, context)
}
