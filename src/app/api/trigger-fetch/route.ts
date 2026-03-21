import { NextResponse } from "next/server"

function getEnv(name: string): string | undefined {
	const v = process.env[name]
	return typeof v === "string" && v.length > 0 ? v : undefined
}

function normalizeAccounts(raw: unknown): string[] {
	if (!Array.isArray(raw)) return []
	const out: string[] = []
	const seen = new Set<string>()
	for (const x of raw) {
		if (typeof x !== "string") continue
		const u = x.trim().replace(/^@+/, "").replace(/\s+/g, "")
		if (!u || seen.has(u)) continue
		seen.add(u)
		out.push(u)
	}
	return out
}

/**
 * GitHub Actions içinde gallery-dl çalıştırır (reels-search repo).
 * Cloudflare’da GITHUB_ACTIONS_PAT, FETCH_TRIGGER_SECRET vb. secret olarak tanımlanmalı.
 */
export async function POST(request: Request) {
	let body: { secret?: string; accounts?: unknown }
	try {
		body = (await request.json()) as { secret?: string; accounts?: unknown }
	} catch {
		return NextResponse.json({ error: "Geçersiz JSON" }, { status: 400 })
	}

	const expectedSecret = getEnv("FETCH_TRIGGER_SECRET")
	if (expectedSecret && body.secret !== expectedSecret) {
		return NextResponse.json({ error: "Yetkisiz" }, { status: 401 })
	}

	const accounts = normalizeAccounts(body.accounts)
	if (accounts.length === 0) {
		return NextResponse.json(
			{ error: "En az bir geçerli kullanıcı adı gerekli" },
			{ status: 400 },
		)
	}

	const owner = getEnv("GITHUB_REPO_OWNER")
	const repo = getEnv("GITHUB_REPO")
	const pat = getEnv("GITHUB_ACTIONS_PAT")

	if (!owner || !repo || !pat) {
		return NextResponse.json(
			{
				error:
					"Sunucu yapılandırması eksik (GITHUB_REPO_OWNER, GITHUB_REPO, GITHUB_ACTIONS_PAT).",
			},
			{ status: 503 },
		)
	}

	/** `repository_dispatch` → aynı repodaki workflow’da `repository_dispatch.types: [reels-fetch]` */
	const url = `https://api.github.com/repos/${owner}/${repo}/dispatches`

	const gh = await fetch(url, {
		method: "POST",
		headers: {
			Accept: "application/vnd.github+json",
			Authorization: `Bearer ${pat}`,
			"X-GitHub-Api-Version": "2022-11-28",
		},
		body: JSON.stringify({
			event_type: "reels-fetch",
			client_payload: {
				accounts_csv: accounts.join(","),
			},
		}),
	})

	if (gh.status === 204) {
		return NextResponse.json({
			ok: true,
			message: "GitHub iş akışı kuyruğa alındı. Birkaç dakika içinde metadata güncellenir.",
			accounts,
		})
	}

	const text = await gh.text()
	let detail = text
	try {
		const j = JSON.parse(text) as { message?: string }
		if (j.message) detail = j.message
	} catch {
		// keep raw
	}

	return NextResponse.json(
		{
			error: "GitHub API hatası",
			status: gh.status,
			detail: detail.slice(0, 500),
		},
		{ status: 502 },
	)
}
