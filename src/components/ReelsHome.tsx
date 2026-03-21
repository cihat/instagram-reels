"use client"

import {
	useVirtualizer,
	measureElement,
} from "@tanstack/react-virtual"
import {
	useCallback,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react"
import { useRouter } from "next/navigation"
import { ArrowUpDown, Search, Settings } from "lucide-react"
import { AccountFilterBar } from "@/components/AccountFilterBar"
import { AccountOrganizeModal } from "@/components/AccountOrganizeModal"
import { CategoryAccountsModal } from "@/components/CategoryAccountsModal"
import { MediaCard } from "@/components/MediaCard"
import { useCategoryFilter } from "@/contexts/CategoryFilterContext"
import { PlayingVideoProvider } from "@/contexts/PlayingVideoContext"
import { ReelsScrollRootContext } from "@/contexts/ReelsScrollRootContext"
import { ShellHeader } from "@/components/ShellHeader"
import { OrderModal } from "@/components/OrderModal"
import { SearchBar } from "@/components/SearchBar"
import { SourcesModal } from "@/components/SourcesModal"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { computeUnassignedUsernames } from "@/lib/category-account-assignment"
import { enqueueMetadataFetchToast } from "@/lib/metadata-fetch-toast"
import {
	ALL_VIDEOS_INDEX_EDITOR_ID,
	OTHER_CATEGORY_ID,
} from "@/lib/reel-categories"
import {
	getFilterOptions,
	isIndexLoaded,
	loadIndex,
	normalizeForSearch,
	search,
} from "@/lib/search"
import { cn } from "@/lib/utils"
import type { MediaItem, SortOption } from "@/lib/types"

const SEARCH_DEBOUNCE_MS = 450
const SORT_STORAGE_KEY = "reels-search-sort"
/** First paint batch; more rows load while scrolling */
const REELS_PAGE_INITIAL = 72
const REELS_PAGE_SIZE = 48
const REELS_SCROLL_LOAD_THRESHOLD_PX = 720

/** Matches Tailwind `columns-*` breakpoints used before virtualization */
const REEL_LANE_MEDIA_QUERIES = [
	{ query: "(min-width: 1536px)", lanes: 7 },
	{ query: "(min-width: 1280px)", lanes: 6 },
	{ query: "(min-width: 1024px)", lanes: 5 },
	{ query: "(min-width: 768px)", lanes: 4 },
	{ query: "(min-width: 640px)", lanes: 3 },
] as const

const REEL_MASONRY_GAP_PX = 8
/** Bottom space above fixed search UI (`pb-24`) */
const REEL_LIST_PADDING_END_PX = 96
/** Below this count, render a normal CSS-columns grid; virtualize only for large lists. */
const REELS_VIRTUAL_MIN_ITEMS = 128

function useReelLaneCount(): number {
	const [lanes, setLanes] = useState(2)

	useLayoutEffect(() => {
		const mqs = REEL_LANE_MEDIA_QUERIES.map(({ query, lanes: l }) => ({
			mq: window.matchMedia(query),
			lanes: l,
		}))

		const sync = () => {
			for (const { mq, lanes: l } of mqs) {
				if (mq.matches) {
					setLanes(l)
					return
				}
			}
			setLanes(2)
		}

		sync()
		for (const { mq } of mqs) mq.addEventListener("change", sync)
		return () => {
			for (const { mq } of mqs) mq.removeEventListener("change", sync)
		}
	}, [])

	return lanes
}

function estimateReelFooterHeight(item: MediaItem | undefined): number {
	if (!item) return 110
	let h = 28 + 40 + 16
	if (item.tags.length > 0) h += 28
	return h
}

function estimateReelTileForColumn(
	item: MediaItem | undefined,
	columnWidthPx: number,
): number {
	if (!item) return 400
	const w = item.width && item.width > 0 ? item.width : 9
	const h = item.height && item.height > 0 ? item.height : 16
	// Match MediaCard `aspectRatioStyle` — no artificial min height (avoids estimate vs DOM mismatch).
	const frameH = Math.max(1, Math.round(columnWidthPx * (h / w)))
	return frameH + estimateReelFooterHeight(item)
}

/** Fallback before the list inner width is measured */
function estimateReelTileHeight(item: MediaItem | undefined): number {
	return estimateReelTileForColumn(item, 158)
}

/** Multi-column flow for loading skeleton only */
const REELS_SKELETON_FLOW_CLASS =
	"columns-2 gap-x-2 sm:columns-3 md:columns-4 lg:columns-5 xl:columns-6 2xl:columns-7"

const REEL_TILE_WRAP_CLASS =
	"mb-2 w-full break-inside-avoid [page-break-inside:avoid]"

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

const SKELETON_HEIGHTS = ["h-64", "h-80", "h-72", "h-72", "h-60"] as const

function SearchSkeleton() {
	return (
		<div className={cn(REELS_SKELETON_FLOW_CLASS, "p-2 sm:p-3")}>
			{Array.from({ length: 18 }).map((_, i) => (
				<div key={i} className={REEL_TILE_WRAP_CLASS}>
					<Skeleton
						className={cn(
							"w-full rounded-2xl",
							SKELETON_HEIGHTS[i % SKELETON_HEIGHTS.length],
						)}
					/>
				</div>
			))}
		</div>
	)
}

export function ReelsHome() {
	const router = useRouter()
	const {
		selectedCategory,
		getEffectiveAccounts,
		bumpIndexEpoch,
		indexEpoch,
		assignableCategoryIds,
		sourcesModalOpen,
		setSourcesModalOpen,
		getCategoryMemberAccounts,
		getHiddenNormsForCategory,
		setCategoryAccountsWithHidden,
		hideCustomCategory,
		isBuiltinCategory,
		getCategoryLabel,
	} = useCategoryFilter()

	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)
	const [query, setQuery] = useState("")
	const [results, setResults] = useState<MediaItem[]>([])
	const [visibleCount, setVisibleCount] = useState(REELS_PAGE_INITIAL)
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
	const [categorySettingsOpen, setCategorySettingsOpen] = useState(false)
	const [headerSettingsCategoryId, setHeaderSettingsCategoryId] = useState<
		string | null
	>(null)
	const [headerOrganizeOpen, setHeaderOrganizeOpen] = useState(false)
	const [selectedAccounts, setSelectedAccounts] = useState<string[]>([])
	const categoryAutoFetchAttemptedRef = useRef<Set<string>>(new Set())
	const queryRef = useRef(query)
	const accountsRef = useRef(selectedAccounts)
	const scrollRef = useRef<HTMLDivElement | null>(null)
	queryRef.current = query
	accountsRef.current = selectedAccounts

	const otherCategoryAccounts = useMemo(() => {
		if (!isIndexLoaded()) return []
		return computeUnassignedUsernames(
			getFilterOptions().usernames,
			assignableCategoryIds,
			getEffectiveAccounts,
		)
		// eslint-disable-next-line react-hooks/exhaustive-deps -- getFilterOptions reads search module; loading/indexEpoch reflect index lifecycle
	}, [assignableCategoryIds, getEffectiveAccounts, loading, indexEpoch])

	const categoryAccounts = useMemo(() => {
		if (!selectedCategory) return null
		if (selectedCategory === OTHER_CATEGORY_ID) return otherCategoryAccounts
		return getEffectiveAccounts(selectedCategory)
	}, [
		selectedCategory,
		getEffectiveAccounts,
		otherCategoryAccounts,
	])

	const accountUsernames = useMemo(() => {
		if (loading || !isIndexLoaded()) return []
		if (categoryAccounts != null) return categoryAccounts
		return getEffectiveAccounts(ALL_VIDEOS_INDEX_EDITOR_ID)
	}, [loading, categoryAccounts, getEffectiveAccounts, indexEpoch])

	const computeSearchResults = useCallback((): MediaItem[] => {
		if (!isIndexLoaded()) return []
		const q = queryRef.current.trim() || undefined
		const cat = selectedCategory
			? selectedCategory === OTHER_CATEGORY_ID
				? otherCategoryAccounts
				: getEffectiveAccounts(selectedCategory)
			: getEffectiveAccounts(ALL_VIDEOS_INDEX_EDITOR_ID)

		if (cat.length === 0) return []
		const allowed = new Set(cat.map((u) => normalizeForSearch(u)))
		const picked = accountsRef.current.filter((u) =>
			allowed.has(normalizeForSearch(u)),
		)
		const usernames = picked.length > 0 ? picked : cat
		return search({ q, usernames })
	}, [selectedCategory, getEffectiveAccounts, otherCategoryAccounts, indexEpoch])

	const replaceSearchResults = useCallback(() => {
		setVisibleCount(REELS_PAGE_INITIAL)
		setResults(computeSearchResults())
	}, [computeSearchResults])

	const runSourcesSubmitInBackground = (payload: {
		accounts: string[]
		secret: string
	}) => {
		enqueueMetadataFetchToast(
			payload.accounts,
			{
				onSuccess: () => {
					bumpIndexEpoch()
					if (isIndexLoaded()) replaceSearchResults()
				},
				onSessionError: () => router.push("/sources"),
			},
			payload.secret,
		)
	}

	const sortedFull = useMemo(
		() => sortItems(results, sortBy),
		[results, sortBy],
	)
	const sortedResults = useMemo(
		() => sortedFull.slice(0, visibleCount),
		[sortedFull, visibleCount],
	)

	useEffect(() => {
		setVisibleCount((c) => Math.min(c, sortedFull.length))
	}, [sortedFull.length])

	const sortedFullRef = useRef(sortedFull)
	sortedFullRef.current = sortedFull
	const visibleCountRef = useRef(visibleCount)
	visibleCountRef.current = visibleCount

	const tryLoadMoreReels = useCallback(() => {
		const el = scrollRef.current
		if (!el) return
		const fullLen = sortedFullRef.current.length
		if (visibleCountRef.current >= fullLen) return
		const { scrollTop, scrollHeight, clientHeight } = el
		if (scrollHeight - scrollTop - clientHeight > REELS_SCROLL_LOAD_THRESHOLD_PX)
			return
		setVisibleCount((c) => Math.min(c + REELS_PAGE_SIZE, fullLen))
	}, [])

	const [reelsScrollRootEl, setReelsScrollRootEl] =
		useState<HTMLDivElement | null>(null)
	const setReelsScrollEl = useCallback((node: HTMLDivElement | null) => {
		scrollRef.current = node
		setReelsScrollRootEl(node)
	}, [])
	const laneCount = useReelLaneCount()
	const listVirtualEnabled =
		!loading && sortedResults.length >= REELS_VIRTUAL_MIN_ITEMS

	const listInnerRef = useRef<HTMLDivElement | null>(null)
	const [listInnerWidth, setListInnerWidth] = useState(0)

	useLayoutEffect(() => {
		const el = listInnerRef.current
		if (!el || !listVirtualEnabled) {
			setListInnerWidth(0)
			return
		}
		const ro = new ResizeObserver(() => {
			setListInnerWidth(el.clientWidth)
		})
		ro.observe(el)
		setListInnerWidth(el.clientWidth)
		return () => ro.disconnect()
	}, [listVirtualEnabled, laneCount])

	const estimateTileSize = useCallback(
		(index: number) => {
			const item = sortedResults[index]
			const iw = listInnerWidth
			const lanes = laneCount
			if (iw > 0 && lanes > 0) {
				const between = (lanes - 1) * REEL_MASONRY_GAP_PX
				const colW = (iw - between) / lanes
				return estimateReelTileForColumn(item, colW)
			}
			return estimateReelTileHeight(item)
		},
		[sortedResults, listInnerWidth, laneCount],
	)

	const virtualizer = useVirtualizer({
		count: sortedResults.length,
		enabled: listVirtualEnabled,
		getScrollElement: () => scrollRef.current,
		estimateSize: estimateTileSize,
		getItemKey: (index) => sortedResults[index]?.id ?? index,
		lanes: laneCount,
		gap: REEL_MASONRY_GAP_PX,
		overscan: 6,
		paddingStart: 8,
		paddingEnd: REEL_LIST_PADDING_END_PX,
		measureElement,
		useAnimationFrameWithResizeObserver: true,
		useScrollendEvent: true,
		isScrollingResetDelay: 220,
	})

	useLayoutEffect(() => {
		const v = virtualizer
		v.shouldAdjustScrollPositionOnItemSizeChange = (item, _delta, instance) => {
			const y = instance.scrollOffset ?? 0
			return item.end < y
		}
		return () => {
			v.shouldAdjustScrollPositionOnItemSizeChange = undefined
		}
	}, [virtualizer])

	useEffect(() => {
		if (loading) return
		const el = scrollRef.current
		if (!el) return
		const onScroll = () => tryLoadMoreReels()
		el.addEventListener("scroll", onScroll, { passive: true })
		const raf = requestAnimationFrame(() => tryLoadMoreReels())
		const ro = new ResizeObserver(() => tryLoadMoreReels())
		ro.observe(el)
		return () => {
			cancelAnimationFrame(raf)
			el.removeEventListener("scroll", onScroll)
			ro.disconnect()
		}
	}, [loading, tryLoadMoreReels, sortedFull.length, visibleCount])

	const runSearchImmediate = () => {
		if (!isIndexLoaded()) return
		replaceSearchResults()
	}

	useEffect(() => {
		loadIndex()
			.catch((e) =>
				setError(e instanceof Error ? e.message : "Could not load index"),
			)
			.finally(() => {
				bumpIndexEpoch()
				setLoading(false)
			})
	}, [bumpIndexEpoch])

	useEffect(() => {
		return () => setSourcesModalOpen(false)
	}, [setSourcesModalOpen])

	useEffect(() => {
		if (loading || !isIndexLoaded()) return
		replaceSearchResults()
	}, [
		loading,
		selectedCategory,
		selectedAccounts,
		indexEpoch,
		categoryAccounts,
		replaceSearchResults,
	])

	useEffect(() => {
		setSelectedAccounts([])
	}, [selectedCategory])

	useEffect(() => {
		if (loading || !selectedCategory || !isIndexLoaded()) return
		if (selectedCategory === OTHER_CATEGORY_ID) return
		if (categoryAutoFetchAttemptedRef.current.has(selectedCategory)) return
		const accounts = getEffectiveAccounts(selectedCategory)
		if (accounts.length === 0) return
		const hasAny =
			search({ usernames: accounts, limit: 1 }).length > 0
		if (hasAny) return
		categoryAutoFetchAttemptedRef.current.add(selectedCategory)
		enqueueMetadataFetchToast(accounts, {
			onSuccess: () => {
				bumpIndexEpoch()
				if (isIndexLoaded()) replaceSearchResults()
			},
			onSessionError: () => router.push("/sources"),
		})
	}, [
		loading,
		selectedCategory,
		getEffectiveAccounts,
		bumpIndexEpoch,
		router,
		replaceSearchResults,
	])

	useEffect(() => {
		if (!isIndexLoaded()) return
		setSearchPending(true)
		const id = setTimeout(() => {
			replaceSearchResults()
			setSearchPending(false)
		}, SEARCH_DEBOUNCE_MS)
		return () => clearTimeout(id)
	}, [query, replaceSearchResults])

	const searchBarWrapRef = useRef<HTMLDivElement>(null)
	const searchInputRef = useRef<HTMLInputElement>(null)
	const [isNarrowViewport, setIsNarrowViewport] = useState(false)
	const [mobileSearchOpen, setMobileSearchOpen] = useState(false)

	useLayoutEffect(() => {
		const mq = window.matchMedia("(max-width: 767px)")
		const sync = () => {
			const narrow = mq.matches
			setIsNarrowViewport(narrow)
			if (!narrow) setMobileSearchOpen(false)
		}
		sync()
		mq.addEventListener("change", sync)
		return () => mq.removeEventListener("change", sync)
	}, [])

	useEffect(() => {
		if (!mobileSearchOpen || !isNarrowViewport) return
		const id = window.setTimeout(() => {
			searchInputRef.current?.focus()
		}, 50)
		return () => window.clearTimeout(id)
	}, [mobileSearchOpen, isNarrowViewport])

	useEffect(() => {
		if (!mobileSearchOpen || !isNarrowViewport) return
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") setMobileSearchOpen(false)
		}
		window.addEventListener("keydown", onKey)
		return () => window.removeEventListener("keydown", onKey)
	}, [mobileSearchOpen, isNarrowViewport])

	useEffect(() => {
		const vv = window.visualViewport
		if (!vv) return

		const wrapEl = searchBarWrapRef.current
		let lastBottom = ""

		const updateBarPosition = () => {
			const wrap = searchBarWrapRef.current
			if (!wrap) return
			const keyboardOffset =
				window.innerHeight - vv.height - vv.offsetTop
			const next =
				keyboardOffset > 20 ? `${Math.round(keyboardOffset)}px` : ""
			if (next === lastBottom) return
			lastBottom = next
			wrap.style.bottom = next
		}

		updateBarPosition()
		/* scroll: page scroll made offsetTop jitter; keyboard resize is enough to track */
		vv.addEventListener("resize", updateBarPosition)
		return () => {
			vv.removeEventListener("resize", updateBarPosition)
			if (wrapEl) wrapEl.style.bottom = ""
		}
	}, [])

	const headerSettingsTitle = useMemo(() => {
		if (!selectedCategory)
			return `Category settings · ${getCategoryLabel(ALL_VIDEOS_INDEX_EDITOR_ID)}`
		if (selectedCategory === OTHER_CATEGORY_ID)
			return "Organize unassigned accounts"
		return `Category settings · ${getCategoryLabel(selectedCategory)}`
	}, [selectedCategory, getCategoryLabel])

	const openHeaderSettings = useCallback(() => {
		if (!selectedCategory) {
			setHeaderSettingsCategoryId(ALL_VIDEOS_INDEX_EDITOR_ID)
			setCategorySettingsOpen(true)
			return
		}
		if (selectedCategory === OTHER_CATEGORY_ID) {
			setHeaderOrganizeOpen(true)
			return
		}
		setHeaderSettingsCategoryId(selectedCategory)
		setCategorySettingsOpen(true)
	}, [selectedCategory])

	const sortMobileButton = (
		<Button
			type="button"
			variant="outline"
			size="icon"
			onClick={() => setOrderOpen(true)}
			className="md:hidden h-9 w-9 shrink-0 rounded-lg border-border/80"
			title="Sort"
			aria-label="Sort"
		>
			<ArrowUpDown className="size-4" />
		</Button>
	)

	const headerTrailing = (
		<div className="flex shrink-0 items-center gap-1">
			{!(isNarrowViewport && mobileSearchOpen) && sortMobileButton}
			<Button
				type="button"
				variant="outline"
				size="icon"
				onClick={openHeaderSettings}
				className="h-9 w-9 shrink-0 rounded-lg border-border/80"
				title={headerSettingsTitle}
				aria-label={headerSettingsTitle}
			>
				<Settings className="size-5" strokeWidth={2.25} />
			</Button>
		</div>
	)

	const sourcesModal = (
		<SourcesModal
			open={sourcesModalOpen}
			onOpenChange={setSourcesModalOpen}
			onBackgroundSubmit={runSourcesSubmitInBackground}
		/>
	)

	const categorySettingsModal = (
		<>
			<AccountOrganizeModal
				open={headerOrganizeOpen}
				onOpenChange={setHeaderOrganizeOpen}
			/>
			<CategoryAccountsModal
				open={categorySettingsOpen}
				onOpenChange={(open) => {
					setCategorySettingsOpen(open)
					if (!open) setHeaderSettingsCategoryId(null)
				}}
				categoryId={
					categorySettingsOpen ? headerSettingsCategoryId : null
				}
				categoryLabel={
					headerSettingsCategoryId
						? getCategoryLabel(headerSettingsCategoryId)
						: undefined
				}
				memberAccounts={
					headerSettingsCategoryId
						? getCategoryMemberAccounts(headerSettingsCategoryId)
						: []
				}
				hiddenNormalized={
					headerSettingsCategoryId
						? getHiddenNormsForCategory(headerSettingsCategoryId)
						: []
				}
				onPersistAccounts={(usernames, hiddenNorms) => {
					if (headerSettingsCategoryId)
						setCategoryAccountsWithHidden(
							headerSettingsCategoryId,
							usernames,
							hiddenNorms,
						)
				}}
				onAfterMetadataSynced={bumpIndexEpoch}
				showHideCategory={
					headerSettingsCategoryId != null &&
					headerSettingsCategoryId !== ALL_VIDEOS_INDEX_EDITOR_ID &&
					!isBuiltinCategory(headerSettingsCategoryId)
				}
				onHideCategory={() => {
					if (!headerSettingsCategoryId) return
					hideCustomCategory(headerSettingsCategoryId)
					setCategorySettingsOpen(false)
					setHeaderSettingsCategoryId(null)
				}}
			/>
		</>
	)

	if (error) {
		return (
			<>
				<div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
					<ShellHeader title="Short videos" actions={headerTrailing} />
					<div className="flex flex-1 items-center justify-center p-4">
						<p className="text-destructive">{error}</p>
					</div>
				</div>
				{sourcesModal}
				{categorySettingsModal}
			</>
		)
	}

	return (
		<PlayingVideoProvider>
			<div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
				<ShellHeader title="Short videos" actions={headerTrailing} />

				{!loading && (
					<AccountFilterBar
						usernames={accountUsernames}
						selected={selectedAccounts}
						onChange={setSelectedAccounts}
					/>
				)}

				<div className="relative flex min-h-0 flex-1 flex-col">
					<ReelsScrollRootContext.Provider value={reelsScrollRootEl}>
						<div
							ref={setReelsScrollEl}
							className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain"
						>
							{loading ? (
								<SearchSkeleton />
							) : sortedResults.length === 0 ? (
								<p className="px-2 py-12 text-center text-muted-foreground pb-24 sm:px-3">
									No results found.
								</p>
							) : listVirtualEnabled ? (
								<div
									ref={listInnerRef}
									className="relative w-full px-2 sm:px-3"
									style={{ height: virtualizer.getTotalSize() }}
								>
									{virtualizer.getVirtualItems().map((vi) => {
										const gap = REEL_MASONRY_GAP_PX
										const betweenLanes = (laneCount - 1) * gap
										return (
											<div
												key={vi.key}
												data-index={vi.index}
												ref={virtualizer.measureElement}
												className="absolute top-0 box-border"
												style={{
													width: `calc((100% - ${betweenLanes}px) / ${laneCount})`,
													left: `calc(${vi.lane} * ((100% - ${betweenLanes}px) / ${laneCount} + ${gap}px))`,
													transform: `translateY(${vi.start}px)`,
												}}
											>
												<MediaCard item={sortedResults[vi.index]} />
											</div>
										)
									})}
								</div>
							) : (
								<div
									className={cn(
										REELS_SKELETON_FLOW_CLASS,
										"p-2 pb-24 sm:p-3",
									)}
								>
									{sortedResults.map((item) => (
										<div key={item.id} className={REEL_TILE_WRAP_CLASS}>
											<MediaCard item={item} />
										</div>
									))}
								</div>
							)}
						</div>
					</ReelsScrollRootContext.Provider>

					<OrderModal
						open={orderOpen}
						onClose={() => setOrderOpen(false)}
						value={sortBy}
						onChange={setSortBy}
					/>

					<div
						ref={searchBarWrapRef}
						className="fixed inset-x-0 bottom-0 z-40 pointer-events-none"
					>
						{isNarrowViewport && mobileSearchOpen && (
							<button
								type="button"
								className="fixed inset-0 z-0 bg-black/45 pointer-events-auto md:hidden"
								aria-label="Close search"
								onClick={() => setMobileSearchOpen(false)}
							/>
						)}
						<div
							className={cn(
								"relative z-10 flex p-2 sm:p-3",
								isNarrowViewport && !mobileSearchOpen
									? "justify-end"
									: "justify-center",
							)}
						>
							{isNarrowViewport && !mobileSearchOpen ? (
								<div className="pointer-events-auto">
									<Button
										type="button"
										size="icon"
										onClick={() => setMobileSearchOpen(true)}
										className="size-14 rounded-full shadow-lg border border-border/80 touch-manipulation"
										aria-label="Open search"
									>
										<Search className="size-6" strokeWidth={2} />
									</Button>
								</div>
							) : (
								<div className="pointer-events-auto w-full max-w-md">
									<SearchBar
										value={query}
										onChange={setQuery}
										onSearch={runSearchImmediate}
										pending={searchPending}
										onOrderClick={() => setOrderOpen(true)}
										inputRef={searchInputRef}
										onCollapse={
											isNarrowViewport
												? () => setMobileSearchOpen(false)
												: undefined
										}
									/>
								</div>
							)}
						</div>
					</div>
				</div>
				{sourcesModal}
				{categorySettingsModal}
			</div>
		</PlayingVideoProvider>
	)
}
