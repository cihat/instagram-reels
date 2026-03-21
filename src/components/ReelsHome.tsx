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
	useSyncExternalStore,
} from "react"
import { useRouter } from "next/navigation"
import { ArrowUpDown, Search, Settings, Shuffle } from "lucide-react"
import { AccountFilterBar } from "@/components/AccountFilterBar"
import { AccountOrganizeModal } from "@/components/AccountOrganizeModal"
import { CategoryAccountsModal } from "@/components/CategoryAccountsModal"
import { MediaCard } from "@/components/MediaCard"
import { PostDetailDialog } from "@/components/PostDetailDialog"
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
	BOOKMARKS_VIEW_ID,
	OTHER_CATEGORY_ID,
} from "@/lib/reel-categories"
import {
	getFilterOptions,
	getMediaItemsByIds,
	isIndexLoaded,
	loadIndex,
	normalizeForSearch,
	search,
} from "@/lib/search"
import { cn } from "@/lib/utils"
import type { MediaItem, SortOption } from "@/lib/types"

const SEARCH_DEBOUNCE_MS = 450
const SORT_STORAGE_KEY = "reels-search-sort"
/** Desktop: first paint batch; more rows load while scrolling */
const REELS_PAGE_INITIAL_DESKTOP = 72
const REELS_PAGE_SIZE_DESKTOP = 48
/** Mobile: fewer tiles + smaller pages = less video decode & layout work */
const REELS_PAGE_INITIAL_MOBILE = 20
const REELS_PAGE_SIZE_MOBILE = 16
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
const REELS_VIRTUAL_MIN_DESKTOP = 128
/** Mobile: virtualize sooner — full-column grids melt low-end GPUs. */
const REELS_VIRTUAL_MIN_MOBILE = 28

function subscribeMaxWidth767(callback: () => void) {
	if (typeof window === "undefined") return () => {}
	const mq = window.matchMedia("(max-width: 767px)")
	mq.addEventListener("change", callback)
	return () => mq.removeEventListener("change", callback)
}

function snapshotMaxWidth767(): boolean {
	return (
		typeof window !== "undefined" &&
		window.matchMedia("(max-width: 767px)").matches
	)
}

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
	"random",
	"relevance",
	"date_desc",
	"date_asc",
	"likes_desc",
	"likes_asc",
]

function getStoredSort(): SortOption {
	if (typeof window === "undefined") return "random"
	try {
		const stored = localStorage.getItem(SORT_STORAGE_KEY)
		if (stored && VALID_SORT_OPTIONS.includes(stored as SortOption))
			return stored as SortOption
	} catch {
		// ignore
	}
	return "random"
}

/** Stable pseudo-random order for a session; reshuffles when `salt` changes (new visit). */
function fnv1aHash32(str: string): number {
	let h = 2166136261
	for (let i = 0; i < str.length; i++) {
		h ^= str.charCodeAt(i)
		h = Math.imul(h, 16777619)
	}
	return h >>> 0
}

function orderItemsRandomSession(items: MediaItem[], salt: string): MediaItem[] {
	const arr = [...items]
	arr.sort(
		(a, b) =>
			fnv1aHash32(`${salt}:${a.id}`) - fnv1aHash32(`${salt}:${b.id}`),
	)
	return arr
}

function newRandomOrderSalt(): string {
	if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
		return crypto.randomUUID()
	}
	return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
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
		bookmarkMediaIds,
		toggleBookmarkMediaId,
		isBookmarkedMediaId,
	} = useCategoryFilter()

	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)
	const [query, setQuery] = useState("")
	const [results, setResults] = useState<MediaItem[]>([])
	const [visibleCount, setVisibleCount] = useState(REELS_PAGE_INITIAL_DESKTOP)
	const [searchPending, setSearchPending] = useState(false)
	const [sortBy, setSortByState] = useState<SortOption>(getStoredSort)
	const [randomOrderSalt, setRandomOrderSalt] = useState(newRandomOrderSalt)

	const setSortBy = useCallback((value: SortOption) => {
		setSortByState(value)
		try {
			localStorage.setItem(SORT_STORAGE_KEY, value)
		} catch {
			// ignore
		}
	}, [])

	const [orderOpen, setOrderOpen] = useState(false)
	const [detailIndex, setDetailIndex] = useState<number | null>(null)

	const reshuffleFeed = useCallback(() => {
		setDetailIndex(null)
		setRandomOrderSalt(newRandomOrderSalt())
		setSortByState((prev) => {
			if (prev !== "random") {
				try {
					localStorage.setItem(SORT_STORAGE_KEY, "random")
				} catch {
					/* ignore */
				}
				return "random"
			}
			return prev
		})
	}, [])
	const [categorySettingsOpen, setCategorySettingsOpen] = useState(false)
	const [headerSettingsCategoryId, setHeaderSettingsCategoryId] = useState<
		string | null
	>(null)
	const [headerOrganizeOpen, setHeaderOrganizeOpen] = useState(false)
	const [selectedAccounts, setSelectedAccounts] = useState<string[]>([])
	const [reelCountByAccount, setReelCountByAccount] = useState<
		Record<string, number>
	>({})
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
		if (selectedCategory === BOOKMARKS_VIEW_ID) return null
		return getEffectiveAccounts(selectedCategory)
	}, [
		selectedCategory,
		getEffectiveAccounts,
		otherCategoryAccounts,
	])

	const headerTitle = useMemo(
		() =>
			selectedCategory
				? getCategoryLabel(selectedCategory)
				: getCategoryLabel(ALL_VIDEOS_INDEX_EDITOR_ID),
		[selectedCategory, getCategoryLabel],
	)

	const accountUsernames = useMemo(() => {
		if (loading || !isIndexLoaded()) return []
		if (selectedCategory === BOOKMARKS_VIEW_ID) {
			const items = getMediaItemsByIds(bookmarkMediaIds)
			const users = [
				...new Set(items.map((i) => i.username).filter(Boolean)),
			]
			return users.sort((a, b) =>
				a.localeCompare(b, "en", { sensitivity: "base" }),
			)
		}
		if (categoryAccounts != null) return categoryAccounts
		return getEffectiveAccounts(ALL_VIDEOS_INDEX_EDITOR_ID)
	}, [
		loading,
		categoryAccounts,
		getEffectiveAccounts,
		indexEpoch,
		selectedCategory,
		bookmarkMediaIds,
	])

	const isNarrowViewport = useSyncExternalStore(
		subscribeMaxWidth767,
		snapshotMaxWidth767,
		() => false,
	)

	const pageSize = isNarrowViewport
		? REELS_PAGE_SIZE_MOBILE
		: REELS_PAGE_SIZE_DESKTOP
	const virtualMinItems = isNarrowViewport
		? REELS_VIRTUAL_MIN_MOBILE
		: REELS_VIRTUAL_MIN_DESKTOP

	const replaceSearchResults = useCallback(() => {
		setVisibleCount(
			isNarrowViewport ? REELS_PAGE_INITIAL_MOBILE : REELS_PAGE_INITIAL_DESKTOP,
		)
		if (!isIndexLoaded()) {
			setResults([])
			setReelCountByAccount({})
			return
		}
		const q = queryRef.current.trim() || undefined

		if (selectedCategory === BOOKMARKS_VIEW_ID) {
			let base = getMediaItemsByIds(bookmarkMediaIds)
			if (q) {
				const qHit = new Set(search({ q }).map((i) => i.id))
				base = base.filter((i) => qHit.has(i.id))
			}
			const countMap = new Map<string, number>()
			for (const item of base) {
				const k = normalizeForSearch(item.username)
				countMap.set(k, (countMap.get(k) ?? 0) + 1)
			}
			const counts: Record<string, number> = {}
			for (const u of accountUsernames) {
				counts[u] = countMap.get(normalizeForSearch(u)) ?? 0
			}
			setReelCountByAccount(counts)

			const allowed = new Set(
				base.map((i) => normalizeForSearch(i.username)),
			)
			const picked = accountsRef.current.filter((u) =>
				allowed.has(normalizeForSearch(u)),
			)
			const usernames = picked.length > 0 ? picked : [...new Set(base.map((i) => i.username))]
			if (usernames.length === 0) {
				setResults(base)
				return
			}
			const uSet = new Set(
				usernames.map((u) => normalizeForSearch(u)),
			)
			setResults(
				base.filter((i) => uSet.has(normalizeForSearch(i.username))),
			)
			return
		}

		const cat = selectedCategory
			? selectedCategory === OTHER_CATEGORY_ID
				? otherCategoryAccounts
				: getEffectiveAccounts(selectedCategory)
			: getEffectiveAccounts(ALL_VIDEOS_INDEX_EDITOR_ID)

		if (cat.length === 0) {
			setResults([])
			setReelCountByAccount({})
			return
		}

		const base = search({ q, usernames: cat })
		const countMap = new Map<string, number>()
		for (const item of base) {
			const k = normalizeForSearch(item.username)
			countMap.set(k, (countMap.get(k) ?? 0) + 1)
		}
		const counts: Record<string, number> = {}
		for (const u of accountUsernames) {
			counts[u] = countMap.get(normalizeForSearch(u)) ?? 0
		}
		setReelCountByAccount(counts)

		const allowed = new Set(cat.map((u) => normalizeForSearch(u)))
		const picked = accountsRef.current.filter((u) =>
			allowed.has(normalizeForSearch(u)),
		)
		const usernames = picked.length > 0 ? picked : cat
		setResults(search({ q, usernames }))
	}, [
		selectedCategory,
		getEffectiveAccounts,
		otherCategoryAccounts,
		accountUsernames,
		bookmarkMediaIds,
		isNarrowViewport,
	])

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

	const sortedFull = useMemo(() => {
		const hasQuery = query.trim() !== ""
		const effectiveSort: SortOption =
			hasQuery && sortBy === "random" ? "relevance" : sortBy
		if (effectiveSort === "random") {
			return orderItemsRandomSession(results, randomOrderSalt)
		}
		return sortItems(results, effectiveSort)
	}, [results, sortBy, query, randomOrderSalt])
	const sortedResults = useMemo(
		() => sortedFull.slice(0, visibleCount),
		[sortedFull, visibleCount],
	)

	useEffect(() => {
		setVisibleCount((c) => Math.min(c, sortedFull.length))
	}, [sortedFull.length])

	const sortedFullRef = useRef(sortedFull)
	sortedFullRef.current = sortedFull

	/** New index rows (e.g. after refresh) — extend slice so items aren’t stuck past `visibleCount`. */
	const prevResultsLengthRef = useRef(-1)
	useEffect(() => {
		const n = results.length
		const prev = prevResultsLengthRef.current
		prevResultsLengthRef.current = n
		if (prev < 0) return
		if (n <= prev) return
		const added = n - prev
		const cap = Math.min(added, pageSize * 3)
		setVisibleCount((c) =>
			Math.min(c + cap, sortedFullRef.current.length),
		)
	}, [results.length, pageSize])

	useEffect(() => {
		if (detailIndex !== null && detailIndex >= sortedFull.length) {
			setDetailIndex(null)
		}
	}, [detailIndex, sortedFull.length])

	const goDetailPrev = useCallback(() => {
		setDetailIndex((i) => (i != null && i > 0 ? i - 1 : i))
	}, [])

	const goDetailNext = useCallback(() => {
		setDetailIndex((i) => {
			if (i == null) return i
			const last = sortedFullRef.current.length - 1
			return i < last ? i + 1 : i
		})
	}, [])
	const visibleCountRef = useRef(visibleCount)
	visibleCountRef.current = visibleCount

	const pageSizeRef = useRef(pageSize)
	pageSizeRef.current = pageSize

	const tryLoadMoreReels = useCallback(() => {
		const el = scrollRef.current
		if (!el) return
		const fullLen = sortedFullRef.current.length
		if (visibleCountRef.current >= fullLen) return
		const { scrollTop, scrollHeight, clientHeight } = el
		if (scrollHeight - scrollTop - clientHeight > REELS_SCROLL_LOAD_THRESHOLD_PX)
			return
		const step = pageSizeRef.current
		setVisibleCount((c) => Math.min(c + step, fullLen))
	}, [])

	const [reelsScrollRootEl, setReelsScrollRootEl] =
		useState<HTMLDivElement | null>(null)
	const setReelsScrollEl = useCallback((node: HTMLDivElement | null) => {
		scrollRef.current = node
		setReelsScrollRootEl(node)
	}, [])
	const laneCount = useReelLaneCount()
	const listVirtualEnabled =
		!loading && sortedResults.length >= virtualMinItems

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
		overscan: isNarrowViewport ? 2 : 6,
		paddingStart: 8,
		paddingEnd: REEL_LIST_PADDING_END_PX,
		measureElement,
		// rAF+RO every frame is costly on low-end phones; desktop keeps smoother masonry measure.
		useAnimationFrameWithResizeObserver: !isNarrowViewport,
		useScrollendEvent: true,
		isScrollingResetDelay: isNarrowViewport ? 320 : 220,
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
	const [mobileSearchOpen, setMobileSearchOpen] = useState(false)

	useEffect(() => {
		if (!isNarrowViewport) setMobileSearchOpen(false)
	}, [isNarrowViewport])

	const wasNarrowViewportRef = useRef<boolean | null>(null)
	useLayoutEffect(() => {
		const was = wasNarrowViewportRef.current
		wasNarrowViewportRef.current = isNarrowViewport
		if (!isNarrowViewport) return
		// Only clamp on first client paint as narrow — not when returning from landscape/desktop.
		if (was !== null) return
		setVisibleCount((c) => Math.min(c, REELS_PAGE_INITIAL_MOBILE))
	}, [isNarrowViewport])

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
		if (selectedCategory === BOOKMARKS_VIEW_ID) return
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
			<Button
				type="button"
				variant="outline"
				size="icon"
				onClick={reshuffleFeed}
				className="h-9 w-9 shrink-0 rounded-lg border-border/80"
				title="Shuffle order"
				aria-label="Shuffle reel order"
			>
				<Shuffle className="size-4" strokeWidth={2} />
			</Button>
			{!(isNarrowViewport && mobileSearchOpen) && sortMobileButton}
			{selectedCategory !== BOOKMARKS_VIEW_ID ? (
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
			) : null}
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
					<ShellHeader title={headerTitle} actions={headerTrailing} />
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
				<ShellHeader title={headerTitle} actions={headerTrailing} />

				{!loading && (
					<AccountFilterBar
						usernames={accountUsernames}
						counts={reelCountByAccount}
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
									{selectedCategory === BOOKMARKS_VIEW_ID &&
									bookmarkMediaIds.length === 0
										? "No bookmarks yet. Tap the bookmark on a reel to save it here."
										: "No results found."}
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
												<MediaCard
													item={sortedResults[vi.index]}
													listIndex={vi.index}
													onOpenDetail={setDetailIndex}
													gridVideoSuspended={detailIndex !== null}
													isDetailOpen={detailIndex === vi.index}
													isBookmarked={isBookmarkedMediaId(
														sortedResults[vi.index].id,
													)}
													onToggleBookmark={toggleBookmarkMediaId}
													narrowViewport={isNarrowViewport}
												/>
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
									{sortedResults.map((item, index) => (
										<div key={item.id} className={REEL_TILE_WRAP_CLASS}>
											<MediaCard
												item={item}
												listIndex={index}
												onOpenDetail={setDetailIndex}
												gridVideoSuspended={detailIndex !== null}
												isDetailOpen={detailIndex === index}
												isBookmarked={isBookmarkedMediaId(item.id)}
												onToggleBookmark={toggleBookmarkMediaId}
												narrowViewport={isNarrowViewport}
											/>
										</div>
									))}
								</div>
							)}
						</div>
					</ReelsScrollRootContext.Provider>

					{detailIndex !== null && sortedFull[detailIndex] ? (
						<PostDetailDialog
							item={sortedFull[detailIndex]}
							open
							onOpenChange={(open) => {
								if (!open) setDetailIndex(null)
							}}
							canGoPrev={detailIndex > 0}
							canGoNext={detailIndex < sortedFull.length - 1}
							onGoPrev={goDetailPrev}
							onGoNext={goDetailNext}
							isBookmarked={isBookmarkedMediaId(
								sortedFull[detailIndex].id,
							)}
							onToggleBookmark={toggleBookmarkMediaId}
						/>
					) : null}

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
