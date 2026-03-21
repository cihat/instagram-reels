export type StoredCustomCategory = { id: string; label: string }

const KEY = "reels-custom-categories-v1"

export function loadCustomCategories(): StoredCustomCategory[] {
	if (typeof window === "undefined") return []
	try {
		const raw = localStorage.getItem(KEY)
		if (!raw) return []
		const parsed = JSON.parse(raw) as unknown
		if (!Array.isArray(parsed)) return []
		const out: StoredCustomCategory[] = []
		for (const row of parsed) {
			if (
				row &&
				typeof row === "object" &&
				"id" in row &&
				"label" in row &&
				typeof (row as StoredCustomCategory).id === "string" &&
				typeof (row as StoredCustomCategory).label === "string"
			) {
				const id = (row as StoredCustomCategory).id.trim()
				const label = (row as StoredCustomCategory).label.trim()
				if (id && label) out.push({ id, label })
			}
		}
		return out
	} catch {
		return []
	}
}

export function persistCustomCategories(cats: StoredCustomCategory[]): void {
	try {
		localStorage.setItem(KEY, JSON.stringify(cats))
	} catch {
		// ignore
	}
}
