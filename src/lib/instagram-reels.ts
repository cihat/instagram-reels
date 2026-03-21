import type { MediaItem } from "@/lib/types"

const UA =
	"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"

function formatFetchError(e: unknown): string {
	if (!(e instanceof Error)) return String(e)
	const parts: string[] = [e.message]
	let c: unknown = e.cause
	let depth = 0
	while (c instanceof Error && depth++ < 6) {
		parts.push(c.message)
		c = c.cause
	}
	return parts.filter(Boolean).join(" | ")
}

function isLikelyEdgeBlockMessage(msg: string): boolean {
	const m = msg.toLowerCase()
	return (
		m.includes("fetch failed") ||
		m.includes("network error") ||
		m.includes("connection") ||
		m.includes("econnreset") ||
		m.includes("socket") ||
		m.includes("tls") ||
		m.includes("certificate")
	)
}

function collectMediaNodes(root: unknown, max = 120): Record<string, unknown>[] {
	const out: Record<string, unknown>[] = []
	const seen = new Set<unknown>()
	const stack: unknown[] = [root]
	while (stack.length && out.length < max) {
		const cur = stack.pop()
		if (cur === null || cur === undefined) continue
		if (typeof cur !== "object") continue
		if (seen.has(cur)) continue
		seen.add(cur)
		if (Array.isArray(cur)) {
			for (const x of cur) stack.push(x)
			continue
		}
		const o = cur as Record<string, unknown>
		if (typeof o.shortcode === "string") {
			const hasVideo =
				Array.isArray(o.video_versions) ||
				typeof o.video_url === "string"
			const hasThumb =
				o.image_versions2 != null || typeof o.display_url === "string"
			if (hasVideo || hasThumb) out.push(o)
		}
		for (const k of Object.keys(o)) stack.push(o[k])
	}
	return out
}

function parseScriptJsonBlocks(html: string): unknown[] {
	const blocks: unknown[] = []
	const re =
		/<script[^>]+type="application\/json"[^>]*>([\s\S]*?)<\/script>/gi
	let m: RegExpExecArray | null
	while ((m = re.exec(html)) !== null) {
		try {
			blocks.push(JSON.parse(m[1]))
		} catch {
			// skip
		}
	}
	return blocks
}

function videoUrlFromNode(node: Record<string, unknown>): string {
	const vv = node.video_versions
	if (Array.isArray(vv) && vv.length > 0) {
		const first = vv[0] as Record<string, unknown>
		if (typeof first.url === "string") return first.url
	}
	if (typeof node.video_url === "string") return node.video_url
	return ""
}

function displayUrlFromNode(node: Record<string, unknown>): string {
	if (typeof node.display_url === "string") return node.display_url
	const iv = node.image_versions2 as Record<string, unknown> | undefined
	const c = iv?.candidates
	if (Array.isArray(c) && c.length > 0) {
		const u = (c[0] as Record<string, unknown>).url
		if (typeof u === "string") return u
	}
	return ""
}

function captionFromNode(node: Record<string, unknown>): string {
	const cap = node.caption as Record<string, unknown> | undefined
	if (cap && typeof cap.text === "string") return cap.text
	const edge = node.edge_media_to_caption as Record<string, unknown> | undefined
	const edges = edge?.edges as unknown[] | undefined
	if (Array.isArray(edges) && edges.length > 0) {
		const n = (edges[0] as Record<string, unknown>).node as
			| Record<string, unknown>
			| undefined
		if (n && typeof n.text === "string") return n.text
	}
	return ""
}

function likesFromNode(node: Record<string, unknown>): number {
	const pl = node.edge_media_preview_like as Record<string, unknown> | undefined
	if (pl && typeof pl.count === "number") return pl.count
	if (typeof node.like_count === "number") return node.like_count
	return 0
}

function takenAtFromNode(node: Record<string, unknown>): string {
	const t = node.taken_at
	if (typeof t === "number") {
		return new Date(t * 1000).toISOString().replace("T", " ").slice(0, 19)
	}
	return ""
}

function nodeToMediaItem(
	node: Record<string, unknown>,
	username: string,
	fallbackFullname: string,
): MediaItem | null {
	const shortcode = node.shortcode
	if (typeof shortcode !== "string") return null
	const postId = String(node.id ?? node.pk ?? shortcode)
	const video_url = videoUrlFromNode(node)
	const display_url = displayUrlFromNode(node)
	if (!video_url && !display_url) return null

	const description = captionFromNode(node)
	const tags =
		description.match(/#[\p{L}\p{N}_]+/gu)?.map((t) => t.slice(1)) ?? []

	return {
		id: postId,
		post_id: postId,
		description,
		tags,
		tags_flat: tags.join(" "),
		username,
		fullname: fallbackFullname || username,
		post_date: takenAtFromNode(node),
		type: "video",
		category: "instagram",
		subcategory: "reels",
		likes: likesFromNode(node),
		post_url: `https://www.instagram.com/reel/${shortcode}/`,
		shortcode,
		file_path: `instagram/${username}/${postId}.mp4`,
		display_url,
		video_url,
		width: typeof node.original_width === "number" ? node.original_width : undefined,
		height: typeof node.original_height === "number" ? node.original_height : undefined,
		extension: "mp4",
	}
}

function shortcodesFromHtml(html: string, limit: number): string[] {
	const re = /\/(?:reel|p)\/([A-Za-z0-9_-]+)\//g
	const seen = new Set<string>()
	let m: RegExpExecArray | null
	while ((m = re.exec(html)) !== null) {
		seen.add(m[1])
		if (seen.size >= limit) break
	}
	return [...seen]
}

type HtmlFetchMode = "cold" | "sameSite"

/**
 * HTML sayfası = tarayıcı navigasyonu; X-Requested-With / CSRF ekleme (Instagram bağlantıyı kesebiliyor).
 */
async function fetchHtml(
	url: string,
	cookie: string,
	mode: HtmlFetchMode,
	referer: string,
): Promise<string> {
	const headers: Record<string, string> = {
		"User-Agent": UA,
		Accept:
			"text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
		"Accept-Language": "tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7",
		Cookie: cookie,
		Referer: referer,
		"Sec-Fetch-Dest": "document",
		"Sec-Fetch-Mode": "navigate",
		"Sec-Fetch-Site": mode === "cold" ? "none" : "same-origin",
		"Sec-Fetch-User": "?1",
		"Upgrade-Insecure-Requests": "1",
		"sec-ch-ua":
			'"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
		"sec-ch-ua-mobile": "?0",
		"sec-ch-ua-platform": '"macOS"',
	}

	const res = await fetch(url, {
		redirect: "follow",
		cache: "no-store",
		headers,
	})
	if (!res.ok) {
		throw new Error(`HTTP ${res.status} ${url}`)
	}
	return res.text()
}

/** Yalnızca UA + Cookie — bazı ortamlarda daha az agresif engel */
async function fetchHtmlMinimal(url: string, cookie: string): Promise<string> {
	const res = await fetch(url, {
		redirect: "follow",
		cache: "no-store",
		headers: {
			"User-Agent": UA,
			Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
			"Accept-Language": "en-US,en;q=0.9",
			Cookie: cookie,
		},
	})
	if (!res.ok) {
		throw new Error(`HTTP ${res.status} ${url}`)
	}
	return res.text()
}

async function fetchHtmlWithRetries(
	url: string,
	cookie: string,
	mode: HtmlFetchMode,
	referer: string,
): Promise<string> {
	let last: unknown
	for (let attempt = 0; attempt < 2; attempt++) {
		try {
			if (attempt === 0) {
				return await fetchHtml(url, cookie, mode, referer)
			}
			await new Promise((r) => setTimeout(r, 450))
			return await fetchHtmlMinimal(url, cookie)
		} catch (e) {
			last = e
		}
	}
	throw last
}

/**
 * Tek kullanıcı için /reels/ ve gerekirse tek tek /reel/{shortcode}/ sayfalarından öğe toplar.
 */
export async function fetchReelsForUser(
	username: string,
	cookie: string,
	options?: { perUserShortcodeCap?: number },
): Promise<{ items: MediaItem[]; warnings: string[] }> {
	const cap = options?.perUserShortcodeCap ?? 24
	const warnings: string[] = []
	const items: MediaItem[] = []
	const seenShort = new Set<string>()

	const reelsUrl = `https://www.instagram.com/${encodeURIComponent(username)}/reels/`
	const profileUrl = `https://www.instagram.com/${encodeURIComponent(username)}/`

	let html: string | null = null
	try {
		html = await fetchHtmlWithRetries(
			reelsUrl,
			cookie,
			"cold",
			"https://www.instagram.com/",
		)
	} catch (e) {
		const detail = formatFetchError(e)
		try {
			html = await fetchHtmlWithRetries(
				profileUrl,
				cookie,
				"cold",
				"https://www.instagram.com/",
			)
			warnings.push(
				`${username}: /reels/ açılamadı (${detail}); profil sayfası denendi.`,
			)
		} catch (e2) {
			warnings.push(
				`${username}: liste yüklenemedi — ${detail} | profil: ${formatFetchError(e2)}`,
			)
			if (isLikelyEdgeBlockMessage(detail) || isLikelyEdgeBlockMessage(formatFetchError(e2))) {
				warnings.push(
					"Instagram isteği sunucu çıkış IP’sinden reddedilmiş olabilir (Cloudflare Workers sık görülür). Aynı INSTAGRAM_COOKIES ile yerelde `npm run dev` deneyin veya metadata için gallery-dl / GitHub Actions kullanın.",
				)
			}
			return { items, warnings }
		}
	}

	if (!html) {
		warnings.push(`${username}: boş yanıt`)
		return { items, warnings }
	}

	for (const block of parseScriptJsonBlocks(html)) {
		for (const node of collectMediaNodes(block)) {
			const item = nodeToMediaItem(node, username, username)
			if (item && !seenShort.has(item.shortcode)) {
				seenShort.add(item.shortcode)
				items.push(item)
			}
		}
	}

	if (items.length === 0) {
		const codes = shortcodesFromHtml(html, cap)
		for (const code of codes) {
			if (seenShort.has(code)) continue
			try {
				const page = await fetchHtmlWithRetries(
					`https://www.instagram.com/reel/${encodeURIComponent(code)}/`,
					cookie,
					"sameSite",
					reelsUrl,
				)
				for (const block of parseScriptJsonBlocks(page)) {
					for (const node of collectMediaNodes(block, 40)) {
						const item = nodeToMediaItem(node, username, username)
						if (item && item.shortcode === code) {
							if (!seenShort.has(item.shortcode)) {
								seenShort.add(item.shortcode)
								items.push(item)
							}
							break
						}
					}
				}
			} catch (e) {
				warnings.push(
					`${username}/${code}: ${e instanceof Error ? e.message : String(e)}`,
				)
			}
			if (items.length >= cap) break
		}
	}

	if (items.length === 0) {
		warnings.push(
			`${username}: medya bulunamadı (oturum çerezi veya Instagram HTML yapısı).`,
		)
	}

	return { items, warnings }
}
