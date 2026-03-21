"use client"

import {
	useCallback,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
	type KeyboardEvent,
} from "react"
import { useRouter } from "next/navigation"
import { Eye, EyeOff, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { enqueueMetadataFetchToast } from "@/lib/metadata-fetch-toast"
import { normalizeForSearch } from "@/lib/search"
import { cn } from "@/lib/utils"

const PERSIST_DEBOUNCE_MS = 350

type Row = { value: string; hidden: boolean }

function usernamesFromRows(rows: Row[]): string[] {
	return [
		...new Set(
			rows.map((r) => r.value.trim().replace(/^@+/, "")).filter(Boolean),
		),
	].sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" }))
}

function hiddenNormsFromRows(rows: Row[]): string[] {
	return [
		...new Set(
			rows
				.filter((r) => r.value.trim() && r.hidden)
				.map((r) => normalizeForSearch(r.value))
				.filter(Boolean),
		),
	].sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" }))
}

function visibleUsernamesFromRows(rows: Row[]): string[] {
	return [
		...new Set(
			rows
				.filter((r) => r.value.trim() && !r.hidden)
				.map((r) => r.value.trim().replace(/^@+/, ""))
				.filter(Boolean),
		),
	].sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" }))
}

function snapshotSorted(usernames: string[]): string {
	return JSON.stringify([...usernames].sort((a, b) => a.localeCompare(b, "en")))
}

type CategoryAccountsModalProps = {
	open: boolean
	onOpenChange: (open: boolean) => void
	categoryId: string | null
	categoryLabel?: string
	/** All accounts in the category (visible + hidden from feed) */
	memberAccounts: string[]
	hiddenNormalized: string[]
	/** Called on debounced changes and when the dialog closes */
	onPersistAccounts: (
		usernames: string[],
		hiddenNormalized: string[],
	) => void
	onAfterMetadataSynced?: () => void
	/** Shown for custom categories */
	showHideCategory?: boolean
	onHideCategory?: () => void
}

export function CategoryAccountsModal({
	open,
	onOpenChange,
	categoryId: category,
	categoryLabel,
	memberAccounts,
	hiddenNormalized,
	onPersistAccounts,
	onAfterMetadataSynced,
	showHideCategory,
	onHideCategory,
}: CategoryAccountsModalProps) {
	const router = useRouter()
	const [rows, setRows] = useState<Row[]>([])
	const inputRefs = useRef<(HTMLInputElement | null)[]>([])
	const pendingFocusRow = useRef<number | null>(null)
	const rowsRef = useRef(rows)
	rowsRef.current = rows
	const categoryRef = useRef(category)
	categoryRef.current = category
	const persistRef = useRef(onPersistAccounts)
	persistRef.current = onPersistAccounts
	const initialVisibleSnapshotRef = useRef("")
	const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
	const suppressCloseFlushRef = useRef(false)

	const runMetadataFetch = useCallback(
		(usernames: string[]) => {
			enqueueMetadataFetchToast(usernames, {
				onSuccess: onAfterMetadataSynced,
				onSessionError: () => {
					onOpenChange(false)
					queueMicrotask(() => router.push("/sources"))
				},
			})
		},
		[onAfterMetadataSynced, onOpenChange, router],
	)

	useEffect(() => {
		if (open) suppressCloseFlushRef.current = false
	}, [open])

	useEffect(() => {
		if (open && category) {
			const hiddenSet = new Set(hiddenNormalized)
			const initial: Row[] =
				memberAccounts.length > 0
					? memberAccounts.map((u) => ({
							value: u,
							hidden: hiddenSet.has(normalizeForSearch(u)),
						}))
					: [{ value: "", hidden: false }]
			setRows(initial)
			const initiallyVisible = memberAccounts.filter(
				(u) => !hiddenSet.has(normalizeForSearch(u)),
			)
			initialVisibleSnapshotRef.current = snapshotSorted(initiallyVisible)
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps -- open/category reset
	}, [open, category])

	useLayoutEffect(() => {
		const idx = pendingFocusRow.current
		if (idx == null) return
		pendingFocusRow.current = null
		inputRefs.current[idx]?.focus()
	}, [rows])

	useEffect(() => {
		if (!open || !category) return
		if (persistTimerRef.current) clearTimeout(persistTimerRef.current)
		persistTimerRef.current = setTimeout(() => {
			persistTimerRef.current = null
			persistRef.current(
				usernamesFromRows(rowsRef.current),
				hiddenNormsFromRows(rowsRef.current),
			)
		}, PERSIST_DEBOUNCE_MS)
		return () => {
			if (persistTimerRef.current) {
				clearTimeout(persistTimerRef.current)
				persistTimerRef.current = null
			}
		}
	}, [rows, open, category])

	const flushPersistAndMaybeFetch = useCallback(() => {
		const cat = categoryRef.current
		if (!cat) return
		if (persistTimerRef.current) {
			clearTimeout(persistTimerRef.current)
			persistTimerRef.current = null
		}
		const list = usernamesFromRows(rowsRef.current)
		const hiddenNorms = hiddenNormsFromRows(rowsRef.current)
		persistRef.current(list, hiddenNorms)
		const visible = visibleUsernamesFromRows(rowsRef.current)
		const nowSnap = snapshotSorted(visible)
		if (visible.length > 0 && nowSnap !== initialVisibleSnapshotRef.current) {
			runMetadataFetch(visible)
			initialVisibleSnapshotRef.current = nowSnap
		}
	}, [runMetadataFetch])

	const handleOpenChange = useCallback(
		(nextOpen: boolean) => {
			if (!nextOpen) {
				if (suppressCloseFlushRef.current) suppressCloseFlushRef.current = false
				else flushPersistAndMaybeFetch()
			}
			onOpenChange(nextOpen)
		},
		[flushPersistAndMaybeFetch, onOpenChange],
	)

	const handleHideCategory = useCallback(() => {
		if (persistTimerRef.current) {
			clearTimeout(persistTimerRef.current)
			persistTimerRef.current = null
		}
		suppressCloseFlushRef.current = true
		onHideCategory?.()
	}, [onHideCategory])

	if (!category) return null

	const label = categoryLabel ?? category

	const addRow = () => {
		const newIndex = rows.length
		pendingFocusRow.current = newIndex
		setRows((r) => [...r, { value: "", hidden: false }])
	}

	const updateRow = (i: number, value: string) => {
		setRows((r) => {
			const next = [...r]
			next[i] = { ...next[i], value }
			return next
		})
	}

	const toggleRowHidden = (i: number) => {
		setRows((r) => {
			const next = [...r]
			if (!next[i]?.value.trim()) return r
			next[i] = { ...next[i], hidden: !next[i].hidden }
			return next
		})
	}

	const handleRowKeyDown = (i: number, e: KeyboardEvent<HTMLInputElement>) => {
		if (e.key !== "Enter") return
		e.preventDefault()
		const raw = e.currentTarget.value.trim().replace(/^@+/, "")
		if (!raw) return
		pendingFocusRow.current = i + 1
		setRows((r) => {
			const next = [...r]
			next[i] = { ...next[i], value: raw }
			next.splice(i + 1, 0, { value: "", hidden: false })
			return next
		})
	}

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogContent className="sm:max-w-md" showCloseButton>
				<DialogHeader>
					<DialogTitle>Edit accounts</DialogTitle>
					<DialogDescription>
						Usernames for “{label}” (without @). Use the eye control to hide an
						account from this category’s feed without removing it. Changes save
						automatically; if visible accounts changed, a metadata fetch runs when
						you close this dialog.
					</DialogDescription>
				</DialogHeader>
				<div className="max-h-[min(50vh,20rem)] space-y-2 overflow-y-auto pr-1">
					{rows.map((row, i) => (
						<div key={i} className="flex gap-2">
							<Button
								type="button"
								variant="outline"
								size="icon"
								className="shrink-0"
								disabled={!row.value.trim()}
								onClick={() => toggleRowHidden(i)}
								title={row.hidden ? "Show in feed" : "Hide from feed"}
								aria-label={row.hidden ? "Show in feed" : "Hide from feed"}
							>
								{row.hidden ? (
									<Eye className="size-3.5" aria-hidden />
								) : (
									<EyeOff className="size-3.5" aria-hidden />
								)}
							</Button>
							<Input
								ref={(el) => {
									inputRefs.current[i] = el
								}}
								value={row.value}
								onChange={(e) => updateRow(i, e.target.value)}
								onKeyDown={(e) => handleRowKeyDown(i, e)}
								placeholder="username"
								className={cn(
									"min-w-0 flex-1 font-mono text-sm",
									row.hidden && row.value.trim() && "opacity-60",
								)}
								autoComplete="off"
							/>
						</div>
					))}
				</div>
				<Button
					type="button"
					variant="outline"
					size="sm"
					className="w-full"
					onClick={addRow}
				>
					<Plus className="mr-1 size-4" />
					Add account
				</Button>
				{showHideCategory && onHideCategory ? (
					<div className="border-t border-border/80 pt-3">
						<Button
							type="button"
							variant="outline"
							size="sm"
							className="w-full"
							onClick={handleHideCategory}
						>
							<EyeOff className="mr-2 size-4" aria-hidden />
							Hide category
						</Button>
						<p className="mt-1.5 text-center text-xs text-muted-foreground">
							Removes it from the sidebar; accounts stay saved. Use Show in the
							sidebar to bring it back.
						</p>
					</div>
				) : null}
			</DialogContent>
		</Dialog>
	)
}
