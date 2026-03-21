/**
 * Instagram CDN images often fail in the browser due to hotlink / referrer rules.
 * Use the in-app proxy for poster and <img> URLs.
 */
export function proxiedImageUrl(raw: string | undefined | null): string | undefined {
	const u = raw?.trim()
	if (!u) return undefined
	try {
		const parsed = new URL(u)
		if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return undefined
		return `/api/image-proxy?url=${encodeURIComponent(parsed.href)}`
	} catch {
		return undefined
	}
}
