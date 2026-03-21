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
	persistCategoryAccountOverrides,
	persistSelectedCategory,
	readStoredSelectedCategoryId,
} from "@/lib/category-accounts-storage"
import {
	loadCustomCategories,
	persistCustomCategories,
	type StoredCustomCategory,
} from "@/lib/custom-categories-storage"
import {
	BUILTIN_REEL_CATEGORY_IDS,
	OTHER_CATEGORY_ID,
	REEL_CATEGORIES,
	getDefaultAccountsForBuiltinCategory,
	slugifyCustomReelCategoryId,
} from "@/lib/reel-categories"
import { normalizeForSearch } from "@/lib/search"

type AddCategoryResult =
	| { ok: true; id: string }
	| { ok: false; error: string }

type CategoryFilterContextValue = {
	/** null = all categories */
	selectedCategory: string | null
	setSelectedCategory: (category: string | null) => void
	accountOverrides: Record<string, string[]>
	setAccountsForCategory: (category: string, usernames: string[]) => void
	getEffectiveAccounts: (category: string) => string[]
	bumpIndexEpoch: () => void
	indexEpoch: number
	customCategories: StoredCustomCategory[]
	/** Built-in then custom, in order */
	sidebarCategories: { id: string; label: string }[]
	addCustomCategory: (displayName: string) => AddCategoryResult
	/** Built-in categories cannot be removed */
	removeCustomCategory: (id: string) => boolean
	isBuiltinCategory: (id: string) => boolean
	getCategoryLabel: (id: string) => string
	/** Local category account storage has been read */
	categoryFilterReady: boolean
	/** Exclusive: removes from all assignable categories, or assigns to one target (and removes from others) */
	moveUsernameToCategory: (username: string, targetCategoryId: string) => void
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
	const [customCategories, setCustomCategories] = useState<
		StoredCustomCategory[]
	>([])
	const [hydrated, setHydrated] = useState(false)
	const [indexEpoch, setIndexEpoch] = useState(0)

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
		setAccountOverrides(loadCategoryAccountOverrides(allowed))
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

	const setAccountsForCategory = useCallback(
		(category: string, usernames: string[]) => {
			const allowed = allowedCategoryIdsFromRef()
			if (category === OTHER_CATEGORY_ID) return
			if (!allowed.has(category)) return
			const cleaned = [
				...new Set(
					usernames
						.map((u) => u.trim().replace(/^@+/, ""))
						.filter(Boolean),
				),
			].sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" }))
			setAccountOverrides((prev) => {
				const next = { ...prev, [category]: cleaned }
				persistCategoryAccountOverrides(next, allowed)
				return next
			})
		},
		[allowedCategoryIdsFromRef],
	)

	const isBuiltinCategory = useCallback(
		(id: string) => BUILTIN_REEL_CATEGORY_IDS.has(id),
		[],
	)

	const removeCustomCategory = useCallback((id: string) => {
		if (BUILTIN_REEL_CATEGORY_IDS.has(id)) return false
		const prevCustom = customCategoriesRef.current
		if (!prevCustom.some((c) => c.id === id)) return false
		const nextCustom = prevCustom.filter((c) => c.id !== id)
		persistCustomCategories(nextCustom)
		setCustomCategories(nextCustom)

		const allowed = new Set([
			...BUILTIN_REEL_CATEGORY_IDS,
			...nextCustom.map((c) => c.id),
		])
		setAccountOverrides((ov) => {
			const nextOv = { ...ov }
			delete nextOv[id]
			persistCategoryAccountOverrides(nextOv, allowed)
			return nextOv
		})

		setSelectedCategoryState((sel) => {
			if (sel === id) {
				persistSelectedCategory(null)
				return null
			}
			return sel
		})
		return true
	}, [])

	const getEffectiveAccounts = useCallback(
		(category: string) => {
			if (category === OTHER_CATEGORY_ID) return []
			if (Object.hasOwn(accountOverrides, category)) {
				return accountOverrides[category] ?? []
			}
			return getDefaultAccountsForBuiltinCategory(category)
		},
		[accountOverrides],
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

			const norm = (s: string) => normalizeForSearch(s)
			const nu = norm(u)

			setAccountOverrides((prev) => {
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
					].sort((a, b) =>
						a.localeCompare(b, "en", { sensitivity: "base" }),
					)
				const removeUser = (list: string[]) =>
					list.filter((x) => norm(x) !== nu)
				const addUser = (list: string[]) => {
					if (list.some((x) => norm(x) === nu)) return sortUnique(list)
					return sortUnique([...list, u])
				}

				const next: Record<string, string[]> = { ...prev }

				if (targetCategoryId === OTHER_CATEGORY_ID) {
					for (const id of assignable) {
						next[id] = removeUser(readEff(id))
					}
					persistCategoryAccountOverrides(next, allowed)
					return next
				}

				for (const id of assignable) {
					if (id === targetCategoryId) continue
					next[id] = removeUser(readEff(id))
				}
				next[targetCategoryId] = addUser(readEff(targetCategoryId))
				persistCategoryAccountOverrides(next, allowed)
				return next
			})
		},
		[allowedCategoryIdsFromRef],
	)

	const bumpIndexEpoch = useCallback(() => {
		setIndexEpoch((e) => e + 1)
	}, [])

	const sidebarCategories = useMemo(
		() => [
			...REEL_CATEGORIES.map((c) => ({ id: c.id, label: c.label })),
			...customCategories,
			{ id: OTHER_CATEGORY_ID, label: "Other" },
		],
		[customCategories],
	)

	const getCategoryLabel = useCallback(
		(id: string) => {
			if (id === OTHER_CATEGORY_ID) return "Other"
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
			getEffectiveAccounts,
			bumpIndexEpoch,
			indexEpoch,
			customCategories,
			sidebarCategories,
			addCustomCategory,
			removeCustomCategory,
			isBuiltinCategory,
			getCategoryLabel,
			categoryFilterReady: hydrated,
			moveUsernameToCategory,
		}),
		[
			hydrated,
			selectedCategory,
			setSelectedCategory,
			accountOverrides,
			setAccountsForCategory,
			getEffectiveAccounts,
			bumpIndexEpoch,
			indexEpoch,
			customCategories,
			sidebarCategories,
			addCustomCategory,
			removeCustomCategory,
			isBuiltinCategory,
			getCategoryLabel,
			moveUsernameToCategory,
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
