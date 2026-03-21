import { getCloudflareContext } from "@opennextjs/cloudflare"
import { instagramCookieHeaderFromUserInput } from "@/lib/instagram-cookie-input"
import { fetchReelsForUser } from "@/lib/instagram-reels"
import type { MediaItem } from "@/lib/types"
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

function mergeByShortcode(existing: MediaItem[], incoming: MediaItem[]): MediaItem[] {
	const map = new Map<string, MediaItem>()
	for (const i of existing) {
		map.set(i.shortcode || i.id, i)
	}
	for (const i of incoming) {
		map.set(i.shortcode || i.id, i)
	}
	return [...map.values()]
}

const MAX_ACCOUNTS_PER_REQUEST = 8

/**
 * Fetches Instagram directly; merges with R2 `index.json` when the binding exists.
 */
export async function POST(request: Request) {
	let body: { secret?: string; accounts?: unknown }
	try {
		body = (await request.json()) as { secret?: string; accounts?: unknown }
	} catch {
		return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
	}

	const rawInput =
		typeof body.secret === "string" ? body.secret : ""
	const trimmedInput = rawInput.trim()
	const cookieFromBody = instagramCookieHeaderFromUserInput(rawInput)
	const expectedSecret = getEnv("FETCH_TRIGGER_SECRET")
	const envCookie = getEnv("INSTAGRAM_COOKIES")

	if (expectedSecret) {
		const secretOk = trimmedInput === expectedSecret
		const cookieOk = Boolean(cookieFromBody)
		if (!secretOk && !cookieOk) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
		}
	}

	const cookie = cookieFromBody || envCookie
	if (!cookie) {
		return NextResponse.json(
			{
				error:
					"No Instagram session found. Paste a cookie export in the form (Netscape file, or sessionid / csrftoken text), or set INSTAGRAM_COOKIES on the server.",
			},
			{ status: 503 },
		)
	}

	const accounts = normalizeAccounts(body.accounts)
	if (accounts.length === 0) {
		return NextResponse.json(
			{ error: "At least one valid username is required" },
			{ status: 400 },
		)
	}

	if (accounts.length > MAX_ACCOUNTS_PER_REQUEST) {
		return NextResponse.json(
			{
				error: `At most ${MAX_ACCOUNTS_PER_REQUEST} accounts per request.`,
			},
			{ status: 400 },
		)
	}

	let bucket: R2Bucket | undefined
	try {
		const { env } = await getCloudflareContext({ async: true })
		bucket = env.REELS_BUCKET
	} catch {
		bucket = undefined
	}

	const allWarnings: string[] = []
	const fetched: MediaItem[] = []

	for (const u of accounts) {
		const { items, warnings } = await fetchReelsForUser(u, cookie)
		allWarnings.push(...warnings)
		fetched.push(...items)
	}

	let existing: MediaItem[] = []
	if (bucket) {
		try {
			const obj = await bucket.get("index.json")
			if (obj) {
				const parsed = JSON.parse(await obj.text()) as unknown
				if (Array.isArray(parsed)) existing = parsed as MediaItem[]
			}
		} catch {
			allWarnings.push(
				"Could not read existing index.json; only new items will be written.",
			)
		}
	}

	const merged = mergeByShortcode(existing, fetched)

	let persisted = false
	if (bucket) {
		try {
			await bucket.put("index.json", JSON.stringify(merged), {
				httpMetadata: { contentType: "application/json" },
			})
			persisted = true
		} catch (e) {
			allWarnings.push(
				`R2 write failed: ${e instanceof Error ? e.message : String(e)}`,
			)
		}
	} else {
		allWarnings.push(
			"REELS_BUCKET is not bound — the index was not persisted in this environment (add R2 with OpenNext/Wrangler).",
		)
	}

	const message =
		fetched.length === 0
			? persisted
				? "No new items; existing index kept. Review warnings."
				: "No new items fetched. Review warnings."
			: persisted
				? "Metadata fetched and index updated. Refresh the page."
				: "Metadata fetched; without R2 the app may still show a stale index."

	return NextResponse.json({
		ok: fetched.length > 0,
		persisted,
		accounts,
		fetchedCount: fetched.length,
		mergedCount: merged.length,
		warnings: allWarnings,
		message,
	})
}
