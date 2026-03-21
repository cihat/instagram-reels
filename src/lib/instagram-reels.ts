import { humanizeInstagramFetchDetail } from "@/lib/instagram-user-messages"
import type { MediaItem } from "@/lib/types"

const UA =
	"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"

/** Instagram web istemcisi (profil / JSON API) */
const IG_APP_ID = "936619743392459"

/** Each /reel/{code}/ HTML fetch costs subrequests; keep bounded for Workers + many accounts. */
const MAX_INDIVIDUAL_REEL_HTML_FETCHES = 12

function csrftokenFromCookie(cookie: string): string | undefined {
	const m = cookie.match(/(?:^|;\s*)csrftoken=([^;]+)/i)
	return m?.[1]?.trim()
}

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
	const next = html.match(
		/<script[^>]*id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i,
	)
	if (next?.[1]) {
		try {
			blocks.push(JSON.parse(next[1]))
		} catch {
			// skip
		}
	}
	return blocks
}

function videoUrlFromNode(node: Record<string, unknown>): string {
	const vv = node.video_versions
	if (Array.isArray(vv) && vv.length > 0) {
		const sorted = [...vv].sort((a, b) => {
			const wa = Number((a as Record<string, unknown>).width) || 0
			const wb = Number((b as Record<string, unknown>).width) || 0
			return wb - wa
		})
		for (const v of sorted) {
			const u = (v as Record<string, unknown>).url
			if (typeof u === "string" && u.length > 0) return u
		}
	}
	if (typeof node.video_url === "string") return node.video_url
	return ""
}

function displayUrlFromNode(node: Record<string, unknown>): string {
	if (typeof node.display_url === "string" && node.display_url) return node.display_url
	if (typeof node.thumbnail_src === "string" && node.thumbnail_src)
		return node.thumbnail_src
	if (typeof node.thumbnail_url === "string" && node.thumbnail_url)
		return node.thumbnail_url
	const iv = node.image_versions2 as Record<string, unknown> | undefined
	const c = iv?.candidates
	if (Array.isArray(c) && c.length > 0) {
		let best = ""
		let bestW = 0
		for (const cand of c) {
			const o = cand as Record<string, unknown>
			const u = o.url
			const w = Number(o.width) || 0
			if (typeof u === "string" && u.length > 0 && w >= bestW) {
				best = u
				bestW = w
			}
		}
		if (best) return best
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
	const t = node.taken_at ?? node.taken_at_timestamp
	if (typeof t === "number") {
		return new Date(t * 1000).toISOString().replace("T", " ").slice(0, 19)
	}
	return ""
}

function isVideoLikeNode(node: Record<string, unknown>): boolean {
	if (node.is_video === true) return true
	if (node.__typename === "GraphVideo") return true
	const pt = node.product_type
	if (typeof pt === "string" && (pt === "clips" || pt === "igtv")) return true
	if (
		typeof pt === "string" &&
		pt === "feed" &&
		(node.is_video === true ||
			Array.isArray(node.video_versions) ||
			typeof node.video_url === "string")
	)
		return true
	if (Array.isArray(node.video_versions) && node.video_versions.length > 0) return true
	if (typeof node.video_url === "string" && node.video_url.length > 0) return true
	return false
}

function dedupeByShortcode(items: MediaItem[]): MediaItem[] {
	const m = new Map<string, MediaItem>()
	for (const i of items) m.set(i.shortcode, i)
	return [...m.values()]
}

function checkIgApiJson(json: unknown): void {
	const j = json as Record<string, unknown>
	if (j.status === "fail") {
		throw new Error(String(j.message ?? "Instagram API status fail"))
	}
}

async function fetchInstagramJson(
	url: string,
	cookie: string,
	referer: string,
): Promise<unknown> {
	const csrf = csrftokenFromCookie(cookie)
	const headers: Record<string, string> = {
		"User-Agent": UA,
		Accept: "*/*",
		"Accept-Language": "en-US,en;q=0.9",
		"X-IG-App-ID": IG_APP_ID,
		"X-Requested-With": "XMLHttpRequest",
		"X-ASBD-ID": "129477",
		Referer: referer,
		Cookie: cookie,
	}
	if (csrf) headers["X-CSRFToken"] = csrf

	let res = await fetch(url, { headers, cache: "no-store" })
	if (!res.ok) {
		res = await fetch(url, {
			headers: {
				"User-Agent": UA,
				Accept: "application/json",
				Cookie: cookie,
				Referer: referer,
			},
			cache: "no-store",
		})
	}
	const text = await res.text()
	if (!res.ok) {
		throw new Error(`API ${res.status} ${text.slice(0, 280)}`)
	}
	try {
		return JSON.parse(text) as unknown
	} catch {
		throw new Error(`API response is not JSON: ${text.slice(0, 120)}`)
	}
}

function timelineItemsFromUser(
	user: Record<string, unknown>,
	username: string,
	fullname: string,
): MediaItem[] {
	const out: MediaItem[] = []
	const edgeKeys = [
		"edge_felix_video_timeline",
		"edge_owner_to_timeline_media",
	] as const

	for (const key of edgeKeys) {
		const edge = user[key] as Record<string, unknown> | undefined
		const edges = edge?.edges as unknown[] | undefined
		if (!Array.isArray(edges)) continue
		for (const e of edges) {
			const node = (e as Record<string, unknown>).node as
				| Record<string, unknown>
				| undefined
			if (!node) continue

			if (node.__typename === "GraphSidecar") {
				const ch = node.edge_sidecar_to_children as
					| Record<string, unknown>
					| undefined
				const cedges = ch?.edges as unknown[] | undefined
				if (Array.isArray(cedges)) {
					for (const ce of cedges) {
						const cn = (ce as Record<string, unknown>).node as
							| Record<string, unknown>
							| undefined
						if (cn && isVideoLikeNode(cn)) {
							const item = nodeToMediaItem(cn, username, fullname)
							if (item) out.push(item)
						}
					}
				}
				continue
			}

			if (isVideoLikeNode(node)) {
				const item = nodeToMediaItem(node, username, fullname)
				if (item) out.push(item)
			}
		}
	}
	return dedupeByShortcode(out)
}

function itemsFromWebProfileJson(json: unknown, username: string): MediaItem[] {
	const j = json as Record<string, unknown>
	const data = j.data as Record<string, unknown> | undefined
	const user = data?.user as Record<string, unknown> | undefined
	if (!user) return []
	const fullname =
		typeof user.full_name === "string" ? user.full_name : username
	return timelineItemsFromUser(user, username, fullname)
}

function extractUserId(user: Record<string, unknown>): string | undefined {
	const id = user.id ?? user.pk
	if (typeof id === "string" || typeof id === "number")
		return String(id)
	return undefined
}

async function itemsFromClipsApi(
	userId: string,
	username: string,
	fullname: string,
	cookie: string,
	referer: string,
): Promise<MediaItem[]> {
	const q = new URLSearchParams({
		include_feed_video: "true",
		page_size: "24",
		target_user_id: userId,
	})
	const url = `https://www.instagram.com/api/v1/clips/user/?${q.toString()}`
	const json = await fetchInstagramJson(url, cookie, referer)
	checkIgApiJson(json)
	const out: MediaItem[] = []
	const root = json as Record<string, unknown>
	const rows = root.items as unknown[] | undefined
	if (Array.isArray(rows)) {
		for (const row of rows) {
			const r = row as Record<string, unknown>
			const media = r.media as Record<string, unknown> | undefined
			if (media) {
				const item = nodeToMediaItem(media, username, fullname)
				if (item) out.push(item)
			}
		}
	}
	if (out.length === 0) {
		for (const node of collectMediaNodes(json, 200)) {
			const item = nodeToMediaItem(node, username, fullname)
			if (item) out.push(item)
		}
	}
	return dedupeByShortcode(out)
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
	/* When video is hidden, only cover + post link */
	if (!video_url && !display_url) return null
	if (!video_url && display_url && !isVideoLikeNode(node)) return null

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

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308])

/**
 * `redirect: "follow"` can burn one subrequest per hop on Workers; Instagram login loops
 * hit the invocation limit quickly. Follow manually with a cap and loop detection.
 */
async function fetchWithBoundedRedirects(
	url: string,
	init: RequestInit,
	maxRedirects = 12,
): Promise<Response> {
	let current = url
	const seen = new Set<string>()
	const chain: string[] = []

	for (let hop = 0; hop <= maxRedirects; hop++) {
		if (seen.has(current)) {
			throw new Error(
				`Redirect loop: ${chain.slice(-8).join(", ")}, ${current}`,
			)
		}
		seen.add(current)
		chain.push(current)

		const res = await fetch(current, { ...init, redirect: "manual" })
		if (REDIRECT_STATUSES.has(res.status)) {
			const loc = res.headers.get("Location")
			if (!loc) {
				throw new Error(`HTTP ${res.status} redirect without Location`)
			}
			current = new URL(loc, current).href
			continue
		}
		return res
	}
	throw new Error(`Too many redirects (${maxRedirects}): ${chain.join(", ")}`)
}

/**
 * HTML page = browser-like navigation; avoid X-Requested-With / extra CSRF (Instagram may cut the connection).
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
		"Accept-Language": "en-US,en;q=0.9",
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

	const res = await fetchWithBoundedRedirects(url, {
		cache: "no-store",
		headers,
	})
	if (!res.ok) {
		throw new Error(`HTTP ${res.status} ${url}`)
	}
	return res.text()
}

/** UA + Cookie only — sometimes hits fewer blocks */
async function fetchHtmlMinimal(url: string, cookie: string): Promise<string> {
	const res = await fetchWithBoundedRedirects(url, {
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
 * Collects items for one user from /reels/ and, if needed, individual /reel/{shortcode}/ pages.
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
	const profileReferer = profileUrl

	const pushItem = (item: MediaItem) => {
		if (seenShort.has(item.shortcode)) return
		if (items.length >= cap) return
		seenShort.add(item.shortcode)
		items.push(item)
	}

	// 1) Official JSON API (HTML often no longer embeds enough data)
	try {
		const infoUrl = `https://www.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(username)}`
		const profileJson = await fetchInstagramJson(
			infoUrl,
			cookie,
			profileReferer,
		)
		checkIgApiJson(profileJson)
		const fromProfile = itemsFromWebProfileJson(profileJson, username)
		for (const it of fromProfile) pushItem(it)

		const data = (profileJson as Record<string, unknown>).data as
			| Record<string, unknown>
			| undefined
		const user = data?.user as Record<string, unknown> | undefined
		const uid = user ? extractUserId(user) : undefined
		const fullname =
			user && typeof user.full_name === "string"
				? user.full_name
				: username

		if (uid && items.length < cap) {
			try {
				const fromClips = await itemsFromClipsApi(
					uid,
					username,
					fullname,
					cookie,
					reelsUrl,
				)
				for (const it of fromClips) pushItem(it)
			} catch (e) {
				warnings.push(
					`${username}: ${humanizeInstagramFetchDetail(formatFetchError(e))}`,
				)
			}
		}
	} catch (e) {
		warnings.push(
			`${username}: ${humanizeInstagramFetchDetail(formatFetchError(e))}`,
		)
	}

	if (items.length >= cap) {
		return { items, warnings }
	}

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
				`${username}: Reels page failed (${humanizeInstagramFetchDetail(detail)}); used profile instead.`,
			)
		} catch (e2) {
			const h1 = humanizeInstagramFetchDetail(detail)
			const h2 = humanizeInstagramFetchDetail(formatFetchError(e2))
			warnings.push(
				h1 === h2
					? `${username}: ${h1}`
					: `${username}: ${h1} ${h2}`,
			)
			if (isLikelyEdgeBlockMessage(detail) || isLikelyEdgeBlockMessage(formatFetchError(e2))) {
				warnings.push(
					"Instagram may be blocking this server’s network. Try running the app locally with the same cookies, or fetch metadata another way.",
				)
			}
			return { items, warnings }
		}
	}

	if (!html) {
		warnings.push(`${username}: Empty response from Instagram.`)
		return { items, warnings }
	}

	for (const block of parseScriptJsonBlocks(html)) {
		for (const node of collectMediaNodes(block)) {
			const item = nodeToMediaItem(node, username, username)
			if (item) pushItem(item)
		}
	}

	if (items.length < cap) {
		const shortcodeBudget = Math.min(
			cap - items.length,
			MAX_INDIVIDUAL_REEL_HTML_FETCHES,
		)
		const codes = shortcodesFromHtml(html, Math.max(0, shortcodeBudget))
		let reelPageFailures = 0
		let lastReelFailureHuman = ""
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
							pushItem(item)
							break
						}
					}
				}
			} catch (e) {
				reelPageFailures++
				lastReelFailureHuman = humanizeInstagramFetchDetail(
					formatFetchError(e),
				)
			}
			if (items.length >= cap) break
		}
		if (reelPageFailures > 0) {
			warnings.push(
				reelPageFailures === 1
					? `${username}: ${lastReelFailureHuman}`
					: `${username}: Could not open ${reelPageFailures} reel pages (${lastReelFailureHuman})`,
			)
		}
	}

	if (items.length === 0) {
		warnings.push(
			`${username}: No reels found. If the account is private, check cookies (sessionid / csrftoken).`,
		)
	}

	return { items, warnings }
}
