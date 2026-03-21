const KEY = "reels-category-favorites-v1"

export function loadCategoryFavoriteOrder(): string[] {
	if (typeof window === "undefined") return []
	try {
		const raw = localStorage.getItem(KEY)
		if (!raw) return []
		const parsed = JSON.parse(raw) as unknown
		if (!Array.isArray(parsed)) return []
		const out: string[] = []
		for (const row of parsed) {
			if (typeof row === "string") {
				const id = row.trim()
				if (id) out.push(id)
			}
		}
		return out
	} catch {
		return []
	}
}

export function persistCategoryFavoriteOrder(ids: string[]): void {
	try {
		localStorage.setItem(KEY, JSON.stringify(ids))
	} catch {
		// ignore
	}
}

export function pruneCategoryFavoriteOrder(
	order: string[],
	allowedIds: ReadonlySet<string>,
): string[] {
	const seen = new Set<string>()
	const out: string[] = []
	for (const id of order) {
		if (!allowedIds.has(id) || seen.has(id)) continue
		seen.add(id)
		out.push(id)
	}
	return out
}
