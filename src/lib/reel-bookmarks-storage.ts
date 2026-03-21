const STORAGE_KEY = "reels-bookmarked-media-ids-v1"

export function loadBookmarkMediaIds(): string[] {
	if (typeof window === "undefined") return []
	try {
		const raw = localStorage.getItem(STORAGE_KEY)
		if (!raw) return []
		const parsed = JSON.parse(raw) as unknown
		if (!Array.isArray(parsed)) return []
		return parsed.filter(
			(x): x is string => typeof x === "string" && x.trim().length > 0,
		)
	} catch {
		return []
	}
}

export function persistBookmarkMediaIds(ids: string[]): void {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(ids))
	} catch {
		// ignore
	}
}

export function toggleBookmarkMediaIdInList(
	prev: string[],
	id: string,
): string[] {
	const trimmed = id.trim()
	if (!trimmed) return prev
	const i = prev.indexOf(trimmed)
	if (i >= 0) return prev.filter((x) => x !== trimmed)
	return [...prev, trimmed]
}
