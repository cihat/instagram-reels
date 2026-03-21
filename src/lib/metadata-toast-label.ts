/** Toast text while metadata is being fetched for the given accounts */
export function metadataLoadingMessage(usernames: string[]): string {
	const cleaned = usernames
		.map((u) => u.trim().replace(/^@+/, ""))
		.filter(Boolean)
	if (cleaned.length === 0) return "Fetching metadata…"

	const tags = cleaned.map((u) => `@${u}`)
	if (tags.length === 1) return `${tags[0]} — fetching metadata…`
	if (tags.length <= 4) return `${tags.join(" ")} — fetching metadata…`
	return `${tags.slice(0, 3).join(" ")} +${tags.length - 3} — fetching metadata…`
}
