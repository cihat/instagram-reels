import { getCloudflareContext } from "@opennextjs/cloudflare"
import { dedupeMediaItemsByReel } from "@/lib/reel-dedupe"
import type { MediaItem } from "@/lib/types"
import {
	clientIpFromRequest,
	consumeKvRateLimit,
	R2_READ_LIMIT,
	R2_READ_WINDOW_SEC,
} from "@/lib/r2-rate-limit"
import { NextResponse } from "next/server"

const CACHE =
	"public, s-maxage=60, stale-while-revalidate=120"

export async function GET(request: Request) {
	const headers = {
		"content-type": "application/json",
		"cache-control": CACHE,
	}

	try {
		const { env } = await getCloudflareContext({ async: true })
		const rl = await consumeKvRateLimit(
			env.RATE_LIMIT_KV,
			"r2-read",
			clientIpFromRequest(request),
			R2_READ_LIMIT,
			R2_READ_WINDOW_SEC,
		)
		if (!rl.ok) {
			return NextResponse.json(
				{ error: "Too many index requests. Try again shortly." },
				{
					status: 429,
					headers: {
						...headers,
						"Retry-After": String(rl.retryAfterSec),
					},
				},
			)
		}

		const bucket = env.REELS_BUCKET
		if (bucket) {
			const obj = await bucket.get("index.json")
			if (obj) {
				const text = await obj.text()
				try {
					const parsed = JSON.parse(text) as unknown
					if (Array.isArray(parsed)) {
						const clean = dedupeMediaItemsByReel(parsed as MediaItem[])
						if (clean.length !== (parsed as MediaItem[]).length) {
							return new NextResponse(JSON.stringify(clean), { headers })
						}
					}
				} catch {
					// geçersiz JSON: ham metin
				}
				return new NextResponse(text, { headers })
			}
		}
	} catch {
		// `next dev` without Wrangler bindings
	}

	const url = new URL("/index.json", request.url)
	const r = await fetch(url, { cache: "no-store" })
	if (r.ok) {
		const text = await r.text()
		try {
			const parsed = JSON.parse(text) as unknown
			if (Array.isArray(parsed)) {
				const clean = dedupeMediaItemsByReel(parsed as MediaItem[])
				return new NextResponse(JSON.stringify(clean), { headers })
			}
		} catch {
			// geçersiz JSON
		}
		return new NextResponse(text, { headers })
	}

	return NextResponse.json([], { status: 200, headers })
}
