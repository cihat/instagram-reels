import { BUILTIN_REEL_CATEGORY_IDS } from "@/lib/reel-categories"

const ACCOUNTS_KEY_V2 = "reels-category-accounts-v2"
const ACCOUNTS_KEY_V1 = "reels-category-accounts-v1"
const SELECTED_CATEGORY_KEY = "reels-selected-category-v1"

function parseAccountMap(raw: string | null): Record<string, string[]> {
	if (!raw) return {}
	try {
		const parsed = JSON.parse(raw) as unknown
		if (parsed && typeof parsed === "object" && !Array.isArray(parsed))
			return parsed as Record<string, string[]>
	} catch {
		// ignore
	}
	return {}
}

export function pruneCategoryAccountsMap(
	map: Record<string, string[]>,
	allowedIds: ReadonlySet<string>,
): Record<string, string[]> {
	const next: Record<string, string[]> = {}
	for (const id of allowedIds) {
		const v = map[id]
		if (Array.isArray(v)) next[id] = v
	}
	return next
}

function onlyBuiltinKeysFromLegacy(
	map: Record<string, string[]>,
): Record<string, string[]> {
	const next: Record<string, string[]> = {}
	for (const id of BUILTIN_REEL_CATEGORY_IDS) {
		const v = map[id]
		if (Array.isArray(v) && v.length > 0) next[id] = v
	}
	return next
}

export function loadCategoryAccountOverrides(
	allowedIds: ReadonlySet<string>,
): Record<string, string[]> {
	if (typeof window === "undefined") return {}
	try {
		let map = parseAccountMap(localStorage.getItem(ACCOUNTS_KEY_V2))
		if (Object.keys(map).length === 0) {
			const legacy = parseAccountMap(localStorage.getItem(ACCOUNTS_KEY_V1))
			map = onlyBuiltinKeysFromLegacy(legacy)
			if (Object.keys(map).length > 0)
				localStorage.setItem(ACCOUNTS_KEY_V2, JSON.stringify(map))
		}
		return pruneCategoryAccountsMap(map, allowedIds)
	} catch {
		// ignore
	}
	return {}
}

export function persistCategoryAccountOverrides(
	map: Record<string, string[]>,
	allowedIds: ReadonlySet<string>,
): void {
	try {
		const pruned = pruneCategoryAccountsMap(map, allowedIds)
		localStorage.setItem(ACCOUNTS_KEY_V2, JSON.stringify(pruned))
	} catch {
		// ignore
	}
}

/** Raw stored value; validity is checked against allowedIds in context */
export function readStoredSelectedCategoryId(): string | null {
	if (typeof window === "undefined") return null
	try {
		const raw = localStorage.getItem(SELECTED_CATEGORY_KEY)
		if (raw === null || raw === "") return null
		if (raw === "__all__") return null
		return raw
	} catch {
		return null
	}
}

export function persistSelectedCategory(category: string | null): void {
	try {
		if (category == null || category === "")
			localStorage.setItem(SELECTED_CATEGORY_KEY, "__all__")
		else localStorage.setItem(SELECTED_CATEGORY_KEY, category)
	} catch {
		// ignore
	}
}
