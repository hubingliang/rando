import {
  assertValidSnapshot,
  GIST_FILE_NAME,
  type AppSnapshot,
  type GistFilePayload,
} from "@/lib/snapshot"

export async function gistGet(
  token: string,
  gistId: string,
  fileName: string = GIST_FILE_NAME,
) {
  const r = await fetch("/api/gist", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "get", token, gistId, fileName }),
  })
  if (!r.ok) {
    const t = await r.text()
    let msg = t
    try {
      const j = JSON.parse(t) as { error?: string }
      if (j.error) msg = j.error
    } catch {
      /* plain text */
    }
    throw new Error(msg || "GET gist failed")
  }
  return r.json() as Promise<{
    content: string
    exportedFileName: string
    gistFiles: string[]
  }>
}

export async function gistPut(
  token: string,
  gistId: string,
  content: string,
  fileName: string = GIST_FILE_NAME,
) {
  const r = await fetch("/api/gist", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "put", token, gistId, fileName, content }),
  })
  if (!r.ok) {
    const t = await r.text()
    let msg = t
    try {
      const j = JSON.parse(t) as { error?: string }
      if (j.error) msg = j.error
    } catch {
      /* plain */
    }
    throw new Error(msg || "PATCH gist failed")
  }
  return r.json() as Promise<{ ok: true }>
}

export async function gistCreate(
  token: string,
  content: string,
  fileName: string = GIST_FILE_NAME,
) {
  const r = await fetch("/api/gist", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "create", token, fileName, content }),
  })
  if (!r.ok) {
    const t = await r.text()
    let msg = t
    try {
      const j = JSON.parse(t) as { error?: string }
      if (j.error) msg = j.error
    } catch {
      /* plain */
    }
    throw new Error(msg || "Create gist failed")
  }
  return r.json() as Promise<{ gistId: string; htmlUrl: string | null }>
}

export function buildGistJson(snapshot: AppSnapshot): string {
  const payload: GistFilePayload = {
    ...snapshot,
    version: 1,
    exportedAt: new Date().toISOString(),
  }
  return JSON.stringify(payload, null, 2)
}

export function readGistFilePayload(text: string): GistFilePayload {
  const o = JSON.parse(text) as unknown
  const s = assertValidSnapshot(o)
  const exportedAt = (o as Record<string, unknown>).exportedAt
  if (typeof exportedAt !== "string") {
    throw new Error("Gist file missing exportedAt")
  }
  return { ...s, version: 1, exportedAt }
}
