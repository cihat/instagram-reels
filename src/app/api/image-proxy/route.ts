import { instagramCookieHeaderFromUserInput } from "@/lib/instagram-cookie-input"
import { NextResponse } from "next/server"

const UA =
	"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"

function instagramCookieForUpstream(): string | undefined {
	const raw = process.env.INSTAGRAM_COOKIES
	if (typeof raw !== "string" || !raw.trim()) return undefined
	const parsed = instagramCookieHeaderFromUserInput(raw)
	return (parsed ?? raw).trim() || undefined
}

function isAllowedInstagramMediaHost(hostname: string): boolean {
	const h = hostname.toLowerCase()
	if (h === "instagram.com" || h === "www.instagram.com") return true
	if (h.endsWith(".cdninstagram.com")) return true
	if (h.endsWith(".fbcdn.net")) return true
	return false
}

export async function GET(request: Request) {
	const { searchParams } = new URL(request.url)
	const raw = searchParams.get("url")
	if (!raw?.trim()) {
		return NextResponse.json({ error: "url required" }, { status: 400 })
	}

	let target: URL
	try {
		target = new URL(raw)
	} catch {
		return NextResponse.json({ error: "invalid url" }, { status: 400 })
	}

	if (target.protocol !== "http:" && target.protocol !== "https:") {
		return NextResponse.json({ error: "schema not allowed" }, { status: 400 })
	}

	if (!isAllowedInstagramMediaHost(target.hostname)) {
		return NextResponse.json({ error: "host not allowed" }, { status: 403 })
	}

	const cookie = instagramCookieForUpstream()
	const headers: Record<string, string> = {
		"User-Agent": UA,
		Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
		"Accept-Language": "en-US,en;q=0.9",
		Referer: "https://www.instagram.com/",
		"Sec-Fetch-Dest": "image",
		"Sec-Fetch-Mode": "no-cors",
		"Sec-Fetch-Site": "cross-site",
	}
	if (cookie) {
		headers.Cookie = cookie
		headers.Origin = "https://www.instagram.com"
	}

	const upstream = await fetch(target.href, {
		headers,
		cache: "no-store",
	})

	if (!upstream.ok) {
		return new NextResponse(null, {
			status: upstream.status,
			headers: { "Cache-Control": "private, no-store" },
		})
	}

	const contentType = upstream.headers.get("content-type") || "image/jpeg"
	// Session cookie may affect the bytes; avoid shared edge caches mixing users.
	const cacheControl = cookie
		? "private, max-age=86400"
		: "public, max-age=86400, s-maxage=86400"
	const okHeaders: Record<string, string> = {
		"Content-Type": contentType,
		"Cache-Control": cacheControl,
	}
	if (cookie) okHeaders.Vary = "Cookie"
	return new NextResponse(upstream.body, {
		status: 200,
		headers: okHeaders,
	})
}
