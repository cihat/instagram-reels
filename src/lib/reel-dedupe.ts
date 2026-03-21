import type { MediaItem } from "@/lib/types"

function shortcodeFromPostUrl(postUrl: string | undefined): string {
	if (!postUrl) return ""
	try {
		const u = new URL(postUrl)
		const m = u.pathname.match(/\/(?:reel|p|reels)\/([^/]+)/i)
		return (m?.[1] || "").trim().toLowerCase()
	} catch {
		return ""
	}
}

/** Stable key for one reel: prefer shortcode (also parsed from URL when missing). */
export function reelMergeKey(item: MediaItem): string {
	const sc = String(item.shortcode || "").trim().toLowerCase()
	if (sc) return sc
	const fromUrl = shortcodeFromPostUrl(item.post_url)
	if (fromUrl) return fromUrl
	const pid = String(item.post_id || "").trim()
	if (pid) return `pid:${pid}`
	return `id:${String(item.id || "").trim() || "unknown"}`
}

function richness(item: MediaItem): number {
	let s = 0
	if (item.video_url) s += 4
	if (item.display_url) s += 2
	if (item.description) s += Math.min(6, item.description.length / 80)
	return s
}

function dedupePass(
	items: MediaItem[],
	keyFn: (i: MediaItem) => string,
): MediaItem[] {
	const m = new Map<string, MediaItem>()
	for (const i of items) {
		const k = keyFn(i)
		const prev = m.get(k)
		if (!prev) m.set(k, i)
		else if (richness(i) > richness(prev)) m.set(k, i)
		else if (richness(i) === richness(prev)) m.set(k, i)
	}
	return [...m.values()]
}

/**
 * Same reel (shortcode or Instagram post_id) appears once; the richer record wins ties.
 */
export function dedupeMediaItemsByReel(items: MediaItem[]): MediaItem[] {
	let v = dedupePass(items, reelMergeKey)
	v = dedupePass(v, (i) => {
		const pid = String(i.post_id || "").trim()
		if (pid) return `pid:${pid}`
		return reelMergeKey(i)
	})
	return v
}
