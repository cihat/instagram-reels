export type RateLimitDenied = { ok: false; retryAfterSec: number }
export type RateLimitOk = { ok: true }
export type RateLimitOutcome = RateLimitOk | RateLimitDenied

/** Client IP behind Workers / proxy (for R2 abuse limits). */
export function clientIpFromRequest(request: Request): string {
	const cf = request.headers.get("cf-connecting-ip")?.trim()
	if (cf) return cf
	const xri = request.headers.get("x-real-ip")?.trim()
	if (xri) return xri
	const xff = request.headers.get("x-forwarded-for")?.trim()
	if (xff) return xff.split(",")[0].trim()
	return "unknown"
}

/**
 * Fixed-window counter in KV. If the binding is missing (e.g. `next dev`), no limit is applied.
 * Under races the limit may be slightly exceeded; enough to curb abuse.
 */
export async function consumeKvRateLimit(
	kv: KVNamespace | undefined,
	keyPrefix: string,
	clientKey: string,
	limit: number,
	windowSec: number,
): Promise<RateLimitOutcome> {
	if (!kv) return { ok: true }
	const windowId = Math.floor(Date.now() / (windowSec * 1000))
	const key = `${keyPrefix}:${clientKey}:${windowId}`
	const raw = await kv.get(key)
	const count = raw ? Math.max(0, parseInt(raw, 10) || 0) : 0
	if (count >= limit) {
		const windowEndMs = (windowId + 1) * windowSec * 1000
		const retryAfterSec = Math.max(
			1,
			Math.ceil((windowEndMs - Date.now()) / 1000),
		)
		return { ok: false, retryAfterSec }
	}
	const ttl = Math.max(60, windowSec * 2 + 10)
	await kv.put(key, String(count + 1), { expirationTtl: ttl })
	return { ok: true }
}

/** GET /api/reels — read R2 index.json */
export const R2_READ_LIMIT = 160
export const R2_READ_WINDOW_SEC = 60

/** POST /api/fetch-metadata — R2 + Instagram */
export const FETCH_METADATA_LIMIT = 12
export const FETCH_METADATA_WINDOW_SEC = 600
