import { normalizeForSearch } from "@/lib/search"

/**
 * Usernames in the index that are not listed under any assignable category
 * (exclusive assignment: each account is either in exactly one category or here).
 */
export function computeUnassignedUsernames(
	indexUsernames: readonly string[],
	assignableCategoryIds: readonly string[],
	getEffectiveAccounts: (categoryId: string) => string[],
): string[] {
	const assigned = new Set<string>()
	for (const id of assignableCategoryIds) {
		for (const u of getEffectiveAccounts(id)) {
			assigned.add(normalizeForSearch(u))
		}
	}
	return indexUsernames
		.filter((u) => !assigned.has(normalizeForSearch(u)))
		.sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" }))
}
