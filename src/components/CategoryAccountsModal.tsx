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
import { Plus, Trash2 } from "lucide-react"
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

const PERSIST_DEBOUNCE_MS = 350

function usernamesFromRows(rows: string[]): string[] {
	return [
		...new Set(
			rows.map((s) => s.trim().replace(/^@+/, "")).filter(Boolean),
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
	accounts: string[]
	/** Called on debounced list changes and when the dialog closes */
	onPersistAccounts: (usernames: string[]) => void
	onAfterMetadataSynced?: () => void
	/** Shown for custom categories */
	showDeleteCategory?: boolean
	onDeleteCategory?: () => void
}

export function CategoryAccountsModal({
	open,
	onOpenChange,
	categoryId: category,
	categoryLabel,
	accounts,
	onPersistAccounts,
	onAfterMetadataSynced,
	showDeleteCategory,
	onDeleteCategory,
}: CategoryAccountsModalProps) {
	const router = useRouter()
	const [rows, setRows] = useState<string[]>([])
	const inputRefs = useRef<(HTMLInputElement | null)[]>([])
	const pendingFocusRow = useRef<number | null>(null)
	const rowsRef = useRef(rows)
	rowsRef.current = rows
	const categoryRef = useRef(category)
	categoryRef.current = category
	const persistRef = useRef(onPersistAccounts)
	persistRef.current = onPersistAccounts
	const initialSnapshotRef = useRef("")
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
			const initial = accounts.length > 0 ? [...accounts] : [""]
			setRows(initial)
			initialSnapshotRef.current = snapshotSorted(accounts)
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps -- open/category
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
			persistRef.current(usernamesFromRows(rowsRef.current))
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
		persistRef.current(list)
		const nowSnap = snapshotSorted(list)
		if (list.length > 0 && nowSnap !== initialSnapshotRef.current) {
			runMetadataFetch(list)
			initialSnapshotRef.current = nowSnap
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

	const handleDeleteCategory = useCallback(() => {
		if (persistTimerRef.current) {
			clearTimeout(persistTimerRef.current)
			persistTimerRef.current = null
		}
		suppressCloseFlushRef.current = true
		onDeleteCategory?.()
	}, [onDeleteCategory])

	if (!category) return null

	const label = categoryLabel ?? category

	const addRow = () => {
		const newIndex = rows.length
		pendingFocusRow.current = newIndex
		setRows((r) => [...r, ""])
	}

	const updateRow = (i: number, value: string) => {
		setRows((r) => {
			const next = [...r]
			next[i] = value
			return next
		})
	}

	const removeRow = (i: number) => {
		setRows((r) => (r.length <= 1 ? [""] : r.filter((_, j) => j !== i)))
	}

	const handleRowKeyDown = (i: number, e: KeyboardEvent<HTMLInputElement>) => {
		if (e.key !== "Enter") return
		e.preventDefault()
		const raw = e.currentTarget.value.trim().replace(/^@+/, "")
		if (!raw) return
		pendingFocusRow.current = i + 1
		setRows((r) => {
			const next = [...r]
			next[i] = raw
			next.splice(i + 1, 0, "")
			return next
		})
	}

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogContent
				className="sm:max-w-md"
				showCloseButton
			>
				<DialogHeader>
					<DialogTitle>Edit accounts</DialogTitle>
					<DialogDescription>
						Usernames for “{label}” (without @). Changes save automatically; if the
						list changed, a metadata fetch starts when you close this dialog.
					</DialogDescription>
				</DialogHeader>
				<div className="max-h-[min(50vh,20rem)] space-y-2 overflow-y-auto pr-1">
					{rows.map((row, i) => (
						<div key={i} className="flex gap-2">
							<Button
								type="button"
								variant="destructive"
								size="icon"
								className="shrink-0"
								onClick={() => removeRow(i)}
								title="Remove row"
								aria-label="Remove row"
							>
								<Trash2 className="size-3.5" aria-hidden />
							</Button>
							<Input
								ref={(el) => {
									inputRefs.current[i] = el
								}}
								value={row}
								onChange={(e) => updateRow(i, e.target.value)}
								onKeyDown={(e) => handleRowKeyDown(i, e)}
								placeholder="username"
								className="min-w-0 flex-1 font-mono text-sm"
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
				{showDeleteCategory && onDeleteCategory ? (
					<div className="border-t border-border/80 pt-3">
						<Button
							type="button"
							variant="destructive"
							size="sm"
							className="w-full"
							onClick={handleDeleteCategory}
						>
							Delete category
						</Button>
						<p className="mt-1.5 text-center text-xs text-muted-foreground">
							Only this custom category and its account list will be removed.
						</p>
					</div>
				) : null}
			</DialogContent>
		</Dialog>
	)
}
