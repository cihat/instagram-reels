"use client"

import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
	type ReactNode,
} from "react"
import {
	loadCategoryAccountOverrides,
	loadCategoryHiddenAccounts,
	persistCategoryAccountOverrides,
	persistCategoryHiddenAccounts,
	persistSelectedCategory,
	readStoredSelectedCategoryId,
} from "@/lib/category-accounts-storage"
import {
	loadCategoryFavoriteOrder,
	persistCategoryFavoriteOrder,
	pruneCategoryFavoriteOrder,
} from "@/lib/category-favorites-storage"
import {
	loadCustomCategories,
	persistCustomCategories,
	type StoredCustomCategory,
} from "@/lib/custom-categories-storage"
import {
	ALL_VIDEOS_INDEX_EDITOR_ID,
	BUILTIN_REEL_CATEGORY_IDS,
	OTHER_CATEGORY_ID,
	REEL_CATEGORIES,
	getDefaultAccountsForBuiltinCategory,
	slugifyCustomReelCategoryId,
} from "@/lib/reel-categories"
import {
	getFilterOptions,
	isIndexLoaded,
	normalizeForSearch,
} from "@/lib/search"

type AddCategoryResult =
	| { ok: true; id: string }
	| { ok: false; error: string }

type CategoryFilterContextValue = {
	/** null = all categories */
	selectedCategory: string | null
	setSelectedCategory: (category: string | null) => void
	accountOverrides: Record<string, string[]>
	setAccountsForCategory: (category: string, usernames: string[]) => void
	/** Members + hidden norms; used by category account editor */
	setCategoryAccountsWithHidden: (
		category: string,
		usernames: string[],
		hiddenNormalized: string[],
	) => void
	/** Full member list (visible + hidden) for a category */
	getCategoryMemberAccounts: (category: string) => string[]
	/** Normalized usernames hidden from the reel grid for that category */
	getHiddenNormsForCategory: (category: string) => string[]
	getEffectiveAccounts: (category: string) => string[]
	bumpIndexEpoch: () => void
	indexEpoch: number
	customCategories: StoredCustomCategory[]
	/** Built-in then visible custom, in order */
	sidebarCategories: { id: string; label: string }[]
	/** Built-in + all custom (including hidden); excludes Other — for exclusive account assignment math */
	assignableCategoryIds: string[]
	addCustomCategory: (displayName: string) => AddCategoryResult
	hideCustomCategory: (id: string) => boolean
	unhideCustomCategory: (id: string) => boolean
	isBuiltinCategory: (id: string) => boolean
	getCategoryLabel: (id: string) => string
	/** Local category account storage has been read */
	categoryFilterReady: boolean
	/** Exclusive: removes from all assignable categories, or assigns to one target (and removes from others) */
	moveUsernameToCategory: (username: string, targetCategoryId: string) => void
	/** Shared with Reels header / sidebar: Source accounts dialog */
	sourcesModalOpen: boolean
	setSourcesModalOpen: (open: boolean) => void
	/** Category ids starred in the sidebar; order defines priority at the top */
	favoriteCategoryOrder: string[]
	toggleFavoriteCategory: (categoryId: string) => void
}

const CategoryFilterContext = createContext<CategoryFilterContextValue | null>(
	null,
)

export function CategoryFilterProvider({ children }: { children: ReactNode }) {
	const [selectedCategory, setSelectedCategoryState] = useState<string | null>(
		null,
	)
	const [accountOverrides, setAccountOverrides] = useState<
		Record<string, string[]>
	>({})
	const [hiddenAccountNormsByCategory, setHiddenAccountNormsByCategory] =
		useState<Record<string, string[]>>({})
	const [customCategories, setCustomCategories] = useState<
		StoredCustomCategory[]
	>([])
	const [hydrated, setHydrated] = useState(false)
	const [indexEpoch, setIndexEpoch] = useState(0)
	const [sourcesModalOpen, setSourcesModalOpen] = useState(false)
	const [favoriteCategoryOrder, setFavoriteCategoryOrder] = useState<
		string[]
	>([])

	const accountOverridesRef = useRef(accountOverrides)
	accountOverridesRef.current = accountOverrides
	const hiddenNormsRef = useRef(hiddenAccountNormsByCategory)
	hiddenNormsRef.current = hiddenAccountNormsByCategory

	const customCategoriesRef = useRef<StoredCustomCategory[]>([])
	customCategoriesRef.current = customCategories

	const allowedCategoryIdsFromRef = useCallback(
		() =>
			new Set([
				...BUILTIN_REEL_CATEGORY_IDS,
				...customCategoriesRef.current.map((c) => c.id),
			]),
		[],
	)

	useEffect(() => {
		const custom = loadCustomCategories()
		setCustomCategories(custom)
		const allowed = new Set([
			...BUILTIN_REEL_CATEGORY_IDS,
			...custom.map((c) => c.id),
		])
		const rawFav = loadCategoryFavoriteOrder()
		const prunedFav = pruneCategoryFavoriteOrder(rawFav, allowed)
		if (prunedFav.length !== rawFav.length)
			persistCategoryFavoriteOrder(prunedFav)
		setFavoriteCategoryOrder(prunedFav)
		setAccountOverrides(loadCategoryAccountOverrides(allowed))
		setHiddenAccountNormsByCategory(loadCategoryHiddenAccounts(allowed))
		const raw = readStoredSelectedCategoryId()
		if (raw && allowed.has(raw)) setSelectedCategoryState(raw)
		else {
			setSelectedCategoryState(null)
			if (raw && !allowed.has(raw)) persistSelectedCategory(null)
		}
		setHydrated(true)
	}, [])

	const setSelectedCategory = useCallback((category: string | null) => {
		const allowed = allowedCategoryIdsFromRef()
		const next =
			category != null && allowed.has(category) ? category : null
		setSelectedCategoryState(next)
		persistSelectedCategory(next)
	}, [allowedCategoryIdsFromRef])

	const norm = useCallback((s: string) => normalizeForSearch(s), [])

	const setCategoryAccountsWithHidden = useCallback(
		(category: string, usernames: string[], hiddenNormalized: string[]) => {
			const allowed = allowedCategoryIdsFromRef()
			if (category === OTHER_CATEGORY_ID) return
			if (
				!allowed.has(category) &&
				category !== ALL_VIDEOS_INDEX_EDITOR_ID
			)
				return
			const cleaned = [
				...new Set(
					usernames
						.map((u) => u.trim().replace(/^@+/, ""))
						.filter(Boolean),
				),
			].sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" }))
			const memberNorms = new Set(cleaned.map((u) => norm(u)))
			const hiddenClean = [
				...new Set(
					hiddenNormalized
						.map((h) => norm(h))
						.filter((h) => h && memberNorms.has(h)),
				),
			].sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" }))
			setAccountOverrides((prev) => {
				const next = { ...prev, [category]: cleaned }
				persistCategoryAccountOverrides(next, allowed)
				return next
			})
			setHiddenAccountNormsByCategory((prev) => {
				const next = { ...prev }
				if (hiddenClean.length === 0) delete next[category]
				else next[category] = hiddenClean
				persistCategoryHiddenAccounts(next, allowed)
				return next
			})
		},
		[allowedCategoryIdsFromRef, norm],
	)

	const setAccountsForCategory = useCallback(
		(category: string, usernames: string[]) => {
			const allowed = allowedCategoryIdsFromRef()
			if (category === OTHER_CATEGORY_ID) return
			if (
				!allowed.has(category) &&
				category !== ALL_VIDEOS_INDEX_EDITOR_ID
			)
				return
			const cleaned = [
				...new Set(
					usernames
						.map((u) => u.trim().replace(/^@+/, ""))
						.filter(Boolean),
				),
			].sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" }))
			const memberNorms = new Set(cleaned.map((u) => norm(u)))
			setAccountOverrides((prev) => {
				const next = { ...prev, [category]: cleaned }
				persistCategoryAccountOverrides(next, allowed)
				return next
			})
			setHiddenAccountNormsByCategory((prev) => {
				const prevH = prev[category] ?? []
				const nextH = prevH.filter((h) => memberNorms.has(h))
				const next = { ...prev }
				if (nextH.length === 0) delete next[category]
				else next[category] = nextH
				persistCategoryHiddenAccounts(next, allowed)
				return next
			})
		},
		[allowedCategoryIdsFromRef, norm],
	)

	const isBuiltinCategory = useCallback(
		(id: string) => BUILTIN_REEL_CATEGORY_IDS.has(id),
		[],
	)

	const hideCustomCategory = useCallback((id: string) => {
		if (BUILTIN_REEL_CATEGORY_IDS.has(id)) return false
		const prev = customCategoriesRef.current
		const idx = prev.findIndex((c) => c.id === id)
		if (idx === -1) return false
		const next = prev.map((c, i) =>
			i === idx ? { id: c.id, label: c.label, hidden: true as const } : c,
		)
		persistCustomCategories(next)
		setCustomCategories(next)
		setSelectedCategoryState((sel) => {
			if (sel === id) {
				persistSelectedCategory(null)
				return null
			}
			return sel
		})
		return true
	}, [])

	const unhideCustomCategory = useCallback((id: string) => {
		const prev = customCategoriesRef.current
		const idx = prev.findIndex((c) => c.id === id)
		if (idx === -1) return false
		const cat = prev[idx]
		if (!cat.hidden) return false
		const next = prev.map((c, i) =>
			i === idx ? { id: c.id, label: c.label } : c,
		)
		persistCustomCategories(next)
		setCustomCategories(next)
		return true
	}, [])

	const getCategoryMemberAccounts = useCallback(
		(category: string) => {
			if (category === OTHER_CATEGORY_ID) return []
			if (category === ALL_VIDEOS_INDEX_EDITOR_ID) {
				if (Object.hasOwn(accountOverrides, category)) {
					return accountOverrides[category] ?? []
				}
				if (isIndexLoaded()) return getFilterOptions().usernames
				return []
			}
			if (Object.hasOwn(accountOverrides, category)) {
				return accountOverrides[category] ?? []
			}
			return getDefaultAccountsForBuiltinCategory(category)
		},
		[accountOverrides, indexEpoch],
	)

	const getHiddenNormsForCategory = useCallback(
		(category: string) => hiddenAccountNormsByCategory[category] ?? [],
		[hiddenAccountNormsByCategory],
	)

	const getEffectiveAccounts = useCallback(
		(category: string) => {
			const members = getCategoryMemberAccounts(category)
			if (members.length === 0) return []
			const hidden = new Set(hiddenAccountNormsByCategory[category] ?? [])
			if (hidden.size === 0) return members
			return members.filter((u) => !hidden.has(norm(u)))
		},
		[getCategoryMemberAccounts, hiddenAccountNormsByCategory, norm],
	)

	const moveUsernameToCategory = useCallback(
		(rawUsername: string, targetCategoryId: string) => {
			const u = rawUsername.trim().replace(/^@+/, "")
			if (!u) return
			const allowed = allowedCategoryIdsFromRef()
			if (
				targetCategoryId !== OTHER_CATEGORY_ID &&
				!allowed.has(targetCategoryId)
			)
				return

			const assignable = [
				...REEL_CATEGORIES.map((c) => c.id),
				...customCategoriesRef.current.map((c) => c.id),
			]

			const normLocal = (s: string) => normalizeForSearch(s)
			const nu = normLocal(u)

			const prev = accountOverridesRef.current
			const readEff = (id: string): string[] => {
				if (Object.hasOwn(prev, id)) return prev[id] ?? []
				return getDefaultAccountsForBuiltinCategory(id)
			}
			const sortUnique = (arr: string[]) =>
				[
					...new Set(
						arr
							.map((x) => x.trim().replace(/^@+/, ""))
							.filter(Boolean),
					),
				].sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" }))
			const removeUser = (list: string[]) =>
				list.filter((x) => normLocal(x) !== nu)
			const addUser = (list: string[]) => {
				if (list.some((x) => normLocal(x) === nu)) return sortUnique(list)
				return sortUnique([...list, u])
			}

			const next: Record<string, string[]> = { ...prev }
			const touched = new Set<string>()

			if (targetCategoryId === OTHER_CATEGORY_ID) {
				for (const id of assignable) {
					next[id] = removeUser(readEff(id))
					touched.add(id)
				}
			} else {
				for (const id of assignable) {
					if (id === targetCategoryId) continue
					next[id] = removeUser(readEff(id))
					touched.add(id)
				}
				next[targetCategoryId] = addUser(readEff(targetCategoryId))
				touched.add(targetCategoryId)
			}

			const nextHidden: Record<string, string[]> = {
				...hiddenNormsRef.current,
			}
			for (const id of touched) {
				const list = nextHidden[id]
				if (!list?.length) continue
				const filtered = list.filter((h) => h !== nu)
				if (filtered.length === 0) delete nextHidden[id]
				else nextHidden[id] = filtered
			}

			persistCategoryAccountOverrides(next, allowed)
			persistCategoryHiddenAccounts(nextHidden, allowed)
			setAccountOverrides(next)
			setHiddenAccountNormsByCategory(nextHidden)
		},
		[allowedCategoryIdsFromRef],
	)

	const bumpIndexEpoch = useCallback(() => {
		setIndexEpoch((e) => e + 1)
	}, [])

	const toggleFavoriteCategory = useCallback((categoryId: string) => {
		const allowed = new Set([
			...BUILTIN_REEL_CATEGORY_IDS,
			...customCategoriesRef.current.map((c) => c.id),
		])
		if (!allowed.has(categoryId)) return
		setFavoriteCategoryOrder((prev) => {
			const next = prev.includes(categoryId)
				? prev.filter((x) => x !== categoryId)
				: [...prev, categoryId]
			persistCategoryFavoriteOrder(next)
			return next
		})
	}, [])

	const assignableCategoryIds = useMemo(
		() => [
			...REEL_CATEGORIES.map((c) => c.id),
			...customCategories.map((c) => c.id),
		],
		[customCategories],
	)

	const sidebarCategories = useMemo(
		() => [
			...REEL_CATEGORIES.map((c) => ({ id: c.id, label: c.label })),
			...customCategories.filter((c) => !c.hidden),
			{ id: OTHER_CATEGORY_ID, label: "Other" },
		],
		[customCategories],
	)

	const getCategoryLabel = useCallback(
		(id: string) => {
			if (id === OTHER_CATEGORY_ID) return "Other"
			if (id === ALL_VIDEOS_INDEX_EDITOR_ID) return "All videos"
			const b = REEL_CATEGORIES.find((c) => c.id === id)
			if (b) return b.label
			return customCategories.find((c) => c.id === id)?.label ?? id
		},
		[customCategories],
	)

	const addCustomCategory = useCallback((displayName: string): AddCategoryResult => {
		const label = displayName.trim()
		if (label.length < 2)
			return { ok: false, error: "Enter at least 2 characters." }

		let base = slugifyCustomReelCategoryId(label)
		if (!base) base = "category"
		if (BUILTIN_REEL_CATEGORY_IDS.has(base))
			return { ok: false, error: "That name is reserved." }

		const prev = customCategoriesRef.current
		const existing = new Set([
			...BUILTIN_REEL_CATEGORY_IDS,
			...prev.map((c) => c.id),
		])
		let id = base
		let n = 2
		while (existing.has(id)) {
			id = `${base}-${n++}`
		}
		const next = [...prev, { id, label }]
		persistCustomCategories(next)
		setCustomCategories(next)
		return { ok: true, id }
	}, [])

	const value = useMemo<CategoryFilterContextValue>(
		() => ({
			selectedCategory: hydrated ? selectedCategory : null,
			setSelectedCategory,
			accountOverrides,
			setAccountsForCategory,
			setCategoryAccountsWithHidden,
			getCategoryMemberAccounts,
			getHiddenNormsForCategory,
			getEffectiveAccounts,
			bumpIndexEpoch,
			indexEpoch,
			customCategories,
			sidebarCategories,
			assignableCategoryIds,
			addCustomCategory,
			hideCustomCategory,
			unhideCustomCategory,
			isBuiltinCategory,
			getCategoryLabel,
			categoryFilterReady: hydrated,
			moveUsernameToCategory,
			sourcesModalOpen,
			setSourcesModalOpen,
			favoriteCategoryOrder,
			toggleFavoriteCategory,
		}),
		[
			hydrated,
			selectedCategory,
			setSelectedCategory,
			accountOverrides,
			setAccountsForCategory,
			setCategoryAccountsWithHidden,
			getCategoryMemberAccounts,
			getHiddenNormsForCategory,
			getEffectiveAccounts,
			bumpIndexEpoch,
			indexEpoch,
			customCategories,
			sidebarCategories,
			assignableCategoryIds,
			addCustomCategory,
			hideCustomCategory,
			unhideCustomCategory,
			isBuiltinCategory,
			getCategoryLabel,
			moveUsernameToCategory,
			sourcesModalOpen,
			favoriteCategoryOrder,
			toggleFavoriteCategory,
		],
	)

	return (
		<CategoryFilterContext.Provider value={value}>
			{children}
		</CategoryFilterContext.Provider>
	)
}

export function useCategoryFilter(): CategoryFilterContextValue {
	const ctx = useContext(CategoryFilterContext)
	if (!ctx)
		throw new Error("useCategoryFilter must be used within CategoryFilterProvider")
	return ctx
}
