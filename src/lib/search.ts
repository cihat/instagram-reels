import Fuse from "fuse.js"
import type { MediaItem, SearchParams } from "./types"

const INDEX_URL = "/api/reels"
const LOCALE = "tr-TR"

const TR_TO_ASCII: [RegExp, string][] = [
	[/\u0131/g, "i"],
	[/\u011f/g, "g"],
	[/\u00fc/g, "u"],
	[/\u00f6/g, "o"],
	[/\u015f/g, "s"],
	[/\u00e7/g, "c"],
	[/\u0130/g, "i"],
	[/\u00dc/g, "u"],
	[/\u00d6/g, "o"],
	[/\u015e/g, "s"],
	[/\u00c7/g, "c"],
	[/\u011e/g, "g"],
]

export function normalizeForSearch(s: string): string {
	let t = (s ?? "").toLocaleLowerCase(LOCALE)
	for (const [re, replacement] of TR_TO_ASCII) {
		t = t.replace(re, replacement)
	}
	return t
}

interface SearchDoc {
	id: string
	searchable: string
}

let items: MediaItem[] = []
let idToItem: Map<string, MediaItem> = new Map()
let fuse: Fuse<SearchDoc> | null = null

function buildSearchString(item: MediaItem): string {
	const parts = [
		item.description,
		item.tags_flat,
		item.username,
		item.fullname,
		item.category,
		item.subcategory,
		item.type,
		item.post_id,
		item.shortcode,
		item.post_date,
	]
	return normalizeForSearch(parts.join(" "))
}

export async function loadIndex(): Promise<void> {
	if (fuse) return
	const res = await fetch(INDEX_URL)
	if (!res.ok) throw new Error("Failed to load index")
	items = (await res.json()) as MediaItem[]
	if (!Array.isArray(items)) {
		items = []
	}
	idToItem = new Map(items.map((i) => [i.id, i]))

	const docs: SearchDoc[] = items.map((item) => ({
		id: item.id,
		searchable: buildSearchString(item),
	}))

	fuse = new Fuse(docs, {
		keys: ["searchable"],
		threshold: 0.35,
		ignoreLocation: true,
		includeScore: false,
	})
}

export function search(params: SearchParams): MediaItem[] {
	if (!fuse || items.length === 0) return []

	let filtered: MediaItem[]

	const q = params.q?.trim()
	if (q) {
		const normalizedQuery = normalizeForSearch(q)
		const results = fuse.search(normalizedQuery)
		const ids = results.map((r) => r.item.id)
		filtered = ids
			.map((id) => idToItem.get(id))
			.filter((item): item is MediaItem => item != null)
	} else {
		filtered = [...items]
	}

	if (params.username?.trim()) {
		const u = normalizeForSearch(params.username.trim())
		filtered = filtered.filter((i) =>
			normalizeForSearch(i.username).includes(u),
		)
	}
	if (params.category?.trim()) {
		const c = normalizeForSearch(params.category.trim())
		filtered = filtered.filter(
			(i) => normalizeForSearch(i.category) === c,
		)
	}
	if (params.type?.trim()) {
		const t = normalizeForSearch(params.type.trim())
		filtered = filtered.filter(
			(i) => normalizeForSearch(i.type) === t,
		)
	}
	if (params.tag?.trim()) {
		const tag = normalizeForSearch(params.tag.trim())
		filtered = filtered.filter((i) =>
			i.tags.some((x) => normalizeForSearch(x).includes(tag)),
		)
	}

	const limit = params.limit ?? 80
	return filtered.slice(0, limit)
}

export function getFilterOptions(): {
	usernames: string[]
	categories: string[]
	types: string[]
} {
	const usernames = [...new Set(items.map((i) => i.username).filter(Boolean))].sort()
	const categories = [...new Set(items.map((i) => i.category).filter(Boolean))].sort()
	const types = [...new Set(items.map((i) => i.type).filter(Boolean))].sort()
	return { usernames, categories, types }
}

export function isIndexLoaded(): boolean {
	return fuse !== null
}
