"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { ArrowUpDown } from "lucide-react"
import { MediaCard } from "@/components/MediaCard"
import { PlayingVideoProvider } from "@/contexts/PlayingVideoContext"
import { OrderModal } from "@/components/OrderModal"
import { SearchBar } from "@/components/SearchBar"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { isIndexLoaded, loadIndex, search } from "@/lib/search"
import type { MediaItem, SortOption } from "@/lib/types"

const SEARCH_DEBOUNCE_MS = 450
const SORT_STORAGE_KEY = "reels-search-sort"

const VALID_SORT_OPTIONS: SortOption[] = [
	"relevance",
	"date_desc",
	"date_asc",
	"likes_desc",
	"likes_asc",
]

function getStoredSort(): SortOption {
	if (typeof window === "undefined") return "relevance"
	try {
		const stored = localStorage.getItem(SORT_STORAGE_KEY)
		if (stored && VALID_SORT_OPTIONS.includes(stored as SortOption))
			return stored as SortOption
	} catch {
		// ignore
	}
	return "relevance"
}

function sortItems(items: MediaItem[], sortBy: SortOption): MediaItem[] {
	if (sortBy === "relevance") return items
	const arr = [...items]
	if (sortBy === "date_desc" || sortBy === "date_asc") {
		const dir = sortBy === "date_desc" ? -1 : 1
		arr.sort((a, b) => {
			const ta = new Date((a.post_date || "").replace(" ", "T")).getTime()
			const tb = new Date((b.post_date || "").replace(" ", "T")).getTime()
			return dir * (ta - tb)
		})
		return arr
	}
	if (sortBy === "likes_desc" || sortBy === "likes_asc") {
		const dir = sortBy === "likes_desc" ? -1 : 1
		arr.sort((a, b) => dir * (a.likes - b.likes))
		return arr
	}
	return arr
}

function SearchSkeleton() {
	return (
		<div className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 p-3 sm:p-4">
			{Array.from({ length: 12 }).map((_, i) => (
				<Skeleton key={i} className="aspect-[9/16] min-h-0 w-full rounded-2xl" />
			))}
		</div>
	)
}

export function ReelsHome() {
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)
	const [query, setQuery] = useState("")
	const [results, setResults] = useState<MediaItem[]>([])
	const [searchPending, setSearchPending] = useState(false)
	const [sortBy, setSortByState] = useState<SortOption>(getStoredSort)

	const setSortBy = (value: SortOption) => {
		setSortByState(value)
		try {
			localStorage.setItem(SORT_STORAGE_KEY, value)
		} catch {
			// ignore
		}
	}
	const [orderOpen, setOrderOpen] = useState(false)
	const queryRef = useRef(query)
	queryRef.current = query

	const sortedResults = useMemo(
		() => sortItems(results, sortBy),
		[results, sortBy],
	)

	const runSearchImmediate = () => {
		if (!isIndexLoaded()) return
		const q = queryRef.current.trim() || undefined
		setResults(search({ q, limit: 80 }))
	}

	useEffect(() => {
		loadIndex()
			.then(() => {
				setResults(search({ limit: 80 }))
			})
			.catch((e) => setError(e instanceof Error ? e.message : "Index yüklenemedi"))
			.finally(() => setLoading(false))
	}, [])

	useEffect(() => {
		if (!isIndexLoaded()) return
		setSearchPending(true)
		const id = setTimeout(() => {
			const q = queryRef.current.trim() || undefined
			setResults(search({ q, limit: 80 }))
			setSearchPending(false)
		}, SEARCH_DEBOUNCE_MS)
		return () => clearTimeout(id)
	}, [query])

	const searchBarWrapRef = useRef<HTMLDivElement>(null)

	useEffect(() => {
		const vv = window.visualViewport
		if (!vv) return

		const wrapEl = searchBarWrapRef.current

		const updateBarPosition = () => {
			const wrap = searchBarWrapRef.current
			if (!wrap) return
			const keyboardOffset =
				window.innerHeight - vv.height - vv.offsetTop
			if (keyboardOffset > 20) {
				wrap.style.bottom = `${keyboardOffset}px`
			} else {
				wrap.style.bottom = ""
			}
		}

		updateBarPosition()
		vv.addEventListener("resize", updateBarPosition)
		vv.addEventListener("scroll", updateBarPosition)
		return () => {
			vv.removeEventListener("resize", updateBarPosition)
			vv.removeEventListener("scroll", updateBarPosition)
			if (wrapEl) wrapEl.style.bottom = ""
		}
	}, [])

	if (error) {
		return (
			<div className="min-h-screen flex items-center justify-center p-4">
				<p className="text-destructive">{error}</p>
			</div>
		)
	}

	return (
		<PlayingVideoProvider>
			<div className="min-h-screen bg-background">
				<main className="min-h-screen">
					{loading ? (
						<SearchSkeleton />
					) : (
						<div className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 p-3 sm:p-4 pb-24">
							{sortedResults.map((item) => (
								<MediaCard key={item.id} item={item} />
							))}
						</div>
					)}
					{sortedResults.length === 0 && !loading && (
						<p className="py-12 text-center text-muted-foreground pb-24">
							Sonuç bulunamadı.
						</p>
					)}
				</main>

				<OrderModal
					open={orderOpen}
					onClose={() => setOrderOpen(false)}
					value={sortBy}
					onChange={setSortBy}
				/>

				<Button
					type="button"
					variant="outline"
					size="icon"
					onClick={() => setOrderOpen(true)}
					className="fixed top-4 right-4 z-50 md:hidden h-12 w-12 rounded-xl border-border/80 shadow-lg bg-card/95 backdrop-blur-sm"
					title="Sıralama"
					aria-label="Sıralama"
				>
					<ArrowUpDown className="size-5" />
				</Button>

				<div
					ref={searchBarWrapRef}
					className="fixed inset-x-0 bottom-0 flex justify-center p-2 sm:p-4 z-40 pointer-events-none"
				>
					<div className="pointer-events-auto w-full max-w-md">
						<SearchBar
							value={query}
							onChange={setQuery}
							onSearch={runSearchImmediate}
							pending={searchPending}
							onOrderClick={() => setOrderOpen(true)}
						/>
					</div>
				</div>
			</div>
		</PlayingVideoProvider>
	)
}
