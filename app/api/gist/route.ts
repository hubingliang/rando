import { NextResponse } from "next/server"

import { GIST_FILE_NAME } from "@/lib/snapshot"

type GistGetResponse = { content: string; exportedFileName: string; gistFiles: string[] }
type GistCreateResponse = { gistId: string; htmlUrl: string | null }

const HEADERS = (token: string) => ({
  Accept: "application/vnd.github+json",
  Authorization: `Bearer ${token.trim()}`,
  "X-GitHub-Api-Version": "2022-11-28",
} as const)

export async function POST(request: Request) {
  const body = (await request.json()) as {
    action: "get" | "put" | "create"
    token: string
    gistId?: string
    fileName?: string
    content?: string
  }

  const token = body.token
  if (!token || typeof token !== "string") {
    return NextResponse.json({ error: "Missing token" }, { status: 400 })
  }

  const fileName = body.fileName ?? GIST_FILE_NAME

  try {
    if (body.action === "get") {
      const gistId = body.gistId
      if (!gistId) {
        return NextResponse.json({ error: "Missing gistId" }, { status: 400 })
      }
      const res = await fetch(`https://api.github.com/gists/${gistId}`, {
        method: "GET",
        headers: HEADERS(token),
        cache: "no-store",
      })
      if (!res.ok) {
        const t = await res.text()
        return NextResponse.json(
          { error: t || res.statusText },
          { status: res.status },
        )
      }
      const gist = (await res.json()) as {
        files: Record<string, { content?: string; truncated?: boolean; filename?: string; raw_url?: string }>
      }
      const f = gist.files[fileName]
      if (!f) {
        const keys = Object.keys(gist.files)
        return NextResponse.json(
          { error: `File "${fileName}" not in gist. Found: ${keys.join(", ")}` },
          { status: 404 },
        )
      }
      let content: string
      if (f.truncated && f.raw_url) {
        const raw = await fetch(f.raw_url)
        content = await raw.text()
      } else {
        content = f.content ?? ""
      }
      const payload: GistGetResponse = {
        content,
        exportedFileName: fileName,
        gistFiles: Object.keys(gist.files),
      }
      return NextResponse.json(payload)
    }

    if (body.action === "put") {
      const gistId = body.gistId
      if (!gistId || body.content === undefined) {
        return NextResponse.json(
          { error: "Missing gistId or content" },
          { status: 400 },
        )
      }
      const res = await fetch(`https://api.github.com/gists/${gistId}`, {
        method: "PATCH",
        headers: {
          ...HEADERS(token),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          files: { [fileName]: { content: body.content } },
        }),
      })
      if (!res.ok) {
        const t = await res.text()
        return NextResponse.json(
          { error: t || res.statusText },
          { status: res.status },
        )
      }
      return NextResponse.json({ ok: true })
    }

    if (body.action === "create") {
      if (body.content === undefined) {
        return NextResponse.json({ error: "Missing content" }, { status: 400 })
      }
      const res = await fetch("https://api.github.com/gists", {
        method: "POST",
        headers: {
          ...HEADERS(token),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          description: "Random Daily sync",
          public: false,
          files: { [fileName]: { content: body.content } },
        }),
      })
      if (!res.ok) {
        const t = await res.text()
        return NextResponse.json(
          { error: t || res.statusText },
          { status: res.status },
        )
      }
      const g = (await res.json()) as { id: string; html_url: string }
      const out: GistCreateResponse = {
        gistId: g.id,
        htmlUrl: g.html_url ?? null,
      }
      return NextResponse.json(out)
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 })
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Gist request failed"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
