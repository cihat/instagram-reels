export interface MediaItem {
	id: string
	post_id: string
	description: string
	tags: string[]
	tags_flat: string
	username: string
	fullname: string
	post_date: string
	type: string
	category: string
	subcategory: string
	likes: number
	post_url: string
	shortcode: string
	file_path: string
	display_url: string
	video_url: string
	width?: number
	height?: number
	extension: string
}

export interface SearchParams {
	q?: string
	tag?: string
	username?: string
	category?: string
	type?: string
	limit?: number
}

export type SortOption =
	| "relevance"
	| "date_desc"
	| "date_asc"
	| "likes_desc"
	| "likes_asc"
