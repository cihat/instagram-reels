import { getCloudflareContext } from "@opennextjs/cloudflare"
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
		const bucket = env.REELS_BUCKET
		if (bucket) {
			const obj = await bucket.get("index.json")
			if (obj) {
				const text = await obj.text()
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
		return new NextResponse(text, { headers })
	}

	return NextResponse.json([], { status: 200, headers })
}
