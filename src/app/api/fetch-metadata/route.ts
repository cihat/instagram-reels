import { getCloudflareContext } from "@opennextjs/cloudflare"
import { instagramCookieHeaderFromUserInput } from "@/lib/instagram-cookie-input"
import { sanitizeClientMetadataWarning } from "@/lib/instagram-user-messages"
import {
	fetchReelsForUser,
	type FetchReelsDateRangeMs,
	type FetchReelsForUserOptions,
} from "@/lib/instagram-reels"
import { dedupeMediaItemsByReel } from "@/lib/reel-dedupe"
import type { MediaItem } from "@/lib/types"
import {
	clientIpFromRequest,
	consumeKvRateLimit,
	FETCH_METADATA_LIMIT,
	FETCH_METADATA_WINDOW_SEC,
} from "@/lib/r2-rate-limit"
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

const MAX_ACCOUNTS_PER_REQUEST = 8

function parseDayOrInstantMs(raw: string, kind: "start" | "end"): number {
	const t = raw.trim()
	if (/^\d{4}-\d{2}-\d{2}$/.test(t)) {
		const [y, mo, d] = t.split("-").map(Number)
		return kind === "start"
			? Date.UTC(y, mo - 1, d, 0, 0, 0, 0)
			: Date.UTC(y, mo - 1, d, 23, 59, 59, 999)
	}
	const ms = Date.parse(t)
	if (!Number.isFinite(ms)) {
		throw new Error(`Invalid date: ${t}`)
	}
	return ms
}

function dateRangeFromBody(
	sinceRaw: unknown,
	untilRaw: unknown,
): FetchReelsDateRangeMs | undefined {
	const sinceStr =
		typeof sinceRaw === "string" && sinceRaw.trim() ? sinceRaw.trim() : ""
	const untilStr =
		typeof untilRaw === "string" && untilRaw.trim() ? untilRaw.trim() : ""
	if (!sinceStr && !untilStr) return undefined
	const since = sinceStr ? parseDayOrInstantMs(sinceStr, "start") : undefined
	const until = untilStr ? parseDayOrInstantMs(untilStr, "end") : undefined
	if (since !== undefined && until !== undefined && since > until) {
		throw new Error("`since` must be on or before `until`")
	}
	return { since, until }
}

function clampInt(n: number, lo: number, hi: number): number {
	return Math.min(hi, Math.max(lo, Math.floor(n)))
}

/**
 * Fetches Instagram directly; merges with R2 `index.json` when the binding exists.
 */
export async function POST(request: Request) {
	let kv: KVNamespace | undefined
	let bucket: R2Bucket | undefined
	try {
		const { env } = await getCloudflareContext({ async: true })
		kv = env.RATE_LIMIT_KV
		bucket = env.REELS_BUCKET
	} catch {
		kv = undefined
		bucket = undefined
	}

	const rl = await consumeKvRateLimit(
		kv,
		"fetch-metadata",
		clientIpFromRequest(request),
		FETCH_METADATA_LIMIT,
		FETCH_METADATA_WINDOW_SEC,
	)
	if (!rl.ok) {
		return NextResponse.json(
			{ error: "Too many metadata refresh requests. Try again later." },
			{
				status: 429,
				headers: { "Retry-After": String(rl.retryAfterSec) },
			},
		)
	}

	let body: {
		secret?: string
		accounts?: unknown
		since?: unknown
		until?: unknown
		maxClipsPages?: unknown
		perUserShortcodeCap?: unknown
	}
	try {
		body = (await request.json()) as typeof body
	} catch {
		return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
	}

	let dateRangeMs: FetchReelsDateRangeMs | undefined
	try {
		dateRangeMs = dateRangeFromBody(body.since, body.until)
	} catch (e) {
		const msg = e instanceof Error ? e.message : String(e)
		return NextResponse.json({ error: msg }, { status: 400 })
	}

	let maxClipsPages: number | undefined
	if (body.maxClipsPages !== undefined && body.maxClipsPages !== null) {
		if (dateRangeMs === undefined) {
			return NextResponse.json(
				{
					error:
						"maxClipsPages only applies when `since` and/or `until` is set.",
				},
				{ status: 400 },
			)
		}
		const n = Number(body.maxClipsPages)
		if (!Number.isFinite(n)) {
			return NextResponse.json(
				{ error: "maxClipsPages must be a number" },
				{ status: 400 },
			)
		}
		maxClipsPages = clampInt(n, 1, 50)
	}

	let perUserShortcodeCap: number | undefined
	if (
		body.perUserShortcodeCap !== undefined &&
		body.perUserShortcodeCap !== null
	) {
		const n = Number(body.perUserShortcodeCap)
		if (!Number.isFinite(n)) {
			return NextResponse.json(
				{ error: "perUserShortcodeCap must be a number" },
				{ status: 400 },
			)
		}
		perUserShortcodeCap = clampInt(n, 1, 2000)
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

	const allWarnings: string[] = []
	const fetched: MediaItem[] = []

	const fetchOptions: FetchReelsForUserOptions | undefined =
		dateRangeMs !== undefined ||
		maxClipsPages !== undefined ||
		perUserShortcodeCap !== undefined
			? {
					...(dateRangeMs !== undefined ? { dateRangeMs } : {}),
					...(maxClipsPages !== undefined ? { maxClipsPages } : {}),
					...(perUserShortcodeCap !== undefined
						? { perUserShortcodeCap }
						: {}),
				}
			: undefined

	for (let i = 0; i < accounts.length; i++) {
		const u = accounts[i]
		if (i > 0) {
			// Space out calls to reduce Instagram rate limits (401 "wait a few minutes").
			await new Promise((r) => setTimeout(r, 2500))
		}
		const { items, warnings } = await fetchReelsForUser(
			u,
			cookie,
			fetchOptions,
		)
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
				"Could not read the saved catalog; only newly fetched items will be kept in this run.",
			)
		}
	}

	const merged = dedupeMediaItemsByReel([...existing, ...fetched])

	let persisted = false
	if (bucket) {
		try {
			await bucket.put("index.json", JSON.stringify(merged), {
				httpMetadata: { contentType: "application/json" },
			})
			persisted = true
		} catch (e) {
			allWarnings.push(
				"Could not save the catalog to storage. Try again or check server configuration.",
			)
		}
	} else {
		allWarnings.push(
			"Storage is not configured here — the catalog was not saved on the server.",
		)
	}

	const message =
		fetched.length === 0
			? persisted
				? "No new reels; your saved catalog is unchanged."
				: "No new reels could be fetched."
			: persisted
				? "Catalog updated. Refresh the page."
				: "Reels fetched, but they were not saved — the grid may look out of date."

	const clientWarnings = [
		...new Set(allWarnings.map(sanitizeClientMetadataWarning)),
	]

	return NextResponse.json({
		ok: fetched.length > 0,
		persisted,
		accounts,
		fetchedCount: fetched.length,
		mergedCount: merged.length,
		warnings: clientWarnings,
		message,
	})
}
