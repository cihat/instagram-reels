"use client"

import { useEffect, useMemo, useState } from "react"
import { ArrowRightLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog"
import { useCategoryFilter } from "@/contexts/CategoryFilterContext"
import { computeUnassignedUsernames } from "@/lib/category-account-assignment"
import { OTHER_CATEGORY_ID } from "@/lib/reel-categories"
import { getFilterOptions, isIndexLoaded } from "@/lib/search"
import { cn } from "@/lib/utils"

const DND_MIME = "text/username"

type AccountOrganizeModalProps = {
	open: boolean
	onOpenChange: (open: boolean) => void
}

function MoveSelect({
	username,
	currentCategoryId,
	options,
	onPick,
}: {
	username: string
	currentCategoryId: string
	options: { id: string; label: string }[]
	onPick: (targetId: string) => void
}) {
	return (
		<select
			className="max-w-[9rem] shrink-0 truncate rounded-md border border-border bg-background px-1.5 py-0.5 text-[10px] text-foreground"
			aria-label={`Move @${username}`}
			value=""
			onChange={(e) => {
				const v = e.target.value
				if (v) onPick(v)
				e.currentTarget.value = ""
			}}
		>
			<option value="">Move to…</option>
			{options
				.filter((o) => o.id !== currentCategoryId)
				.map((o) => (
					<option key={o.id} value={o.id}>
						{o.label}
					</option>
				))}
		</select>
	)
}

export function AccountOrganizeModal({
	open,
	onOpenChange,
}: AccountOrganizeModalProps) {
	const {
		sidebarCategories,
		getEffectiveAccounts,
		moveUsernameToCategory,
		indexEpoch,
	} = useCategoryFilter()

	const [dropTarget, setDropTarget] = useState<string | null>(null)

	const assignable = useMemo(
		() => sidebarCategories.filter((c) => c.id !== OTHER_CATEGORY_ID),
		[sidebarCategories],
	)

	const assignableIds = useMemo(
		() => assignable.map((c) => c.id),
		[assignable],
	)

	const moveTargets = useMemo(
		() => [
			{ id: OTHER_CATEGORY_ID, label: "Other" },
			...assignable.map((c) => ({ id: c.id, label: c.label })),
		],
		[assignable],
	)

	const indexUsernames = useMemo(() => {
		if (!open || !isIndexLoaded()) return []
		return getFilterOptions().usernames
	}, [open, indexEpoch])

	const otherUsernames = useMemo(
		() =>
			computeUnassignedUsernames(
				indexUsernames,
				assignableIds,
				getEffectiveAccounts,
			),
		[indexUsernames, assignableIds, getEffectiveAccounts],
	)

	useEffect(() => {
		if (!open) setDropTarget(null)
	}, [open])

	const droppableProps = (categoryId: string) => ({
		onDragOver: (e: React.DragEvent) => {
			e.preventDefault()
			e.dataTransfer.dropEffect = "move"
			setDropTarget(categoryId)
		},
		onDragLeave: (e: React.DragEvent) => {
			if (!e.currentTarget.contains(e.relatedTarget as Node))
				setDropTarget((t) => (t === categoryId ? null : t))
		},
		onDrop: (e: React.DragEvent) => {
			e.preventDefault()
			const u =
				e.dataTransfer.getData(DND_MIME) ||
				e.dataTransfer.getData("text/plain")
			if (u) moveUsernameToCategory(u, categoryId)
			setDropTarget(null)
		},
	})

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="flex max-h-[min(90dvh,720px)] w-[min(96vw,40rem)] max-w-[min(96vw,40rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
				<DialogHeader className="shrink-0 border-b border-border/80 px-4 py-3 text-left">
					<DialogTitle className="flex items-center gap-2">
						<ArrowRightLeft className="size-4 opacity-80" aria-hidden />
						Organize accounts
					</DialogTitle>
					<DialogDescription className="text-pretty">
						Drag a username into another category or into{" "}
						<strong className="text-foreground">Other</strong> to unassign. You
						can also use the menu on each chip. One account lives in one category
						at a time (or in Other if it is not on any list).
					</DialogDescription>
				</DialogHeader>

				<div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
					{!isIndexLoaded() ? (
						<p className="text-sm text-muted-foreground">
							Load the grid once so we can list accounts from your index.
						</p>
					) : null}

					<section
						{...droppableProps(OTHER_CATEGORY_ID)}
						className={cn(
							"rounded-xl border border-dashed p-3 transition-colors",
							dropTarget === OTHER_CATEGORY_ID
								? "border-primary bg-primary/5"
								: "border-border/80 bg-muted/20",
						)}
					>
						<h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
							Other — not in any category
						</h3>
						{otherUsernames.length === 0 ? (
							<p className="text-xs text-muted-foreground">
								Every indexed account is assigned to a category.
							</p>
						) : (
							<div className="flex flex-wrap gap-2">
								{otherUsernames.map((u) => (
									<div
										key={u}
										className="flex max-w-full items-center gap-1 rounded-lg border border-border/80 bg-background px-2 py-1 shadow-xs"
									>
										<span
											draggable
											onDragStart={(e) => {
												e.dataTransfer.setData(DND_MIME, u)
												e.dataTransfer.setData("text/plain", u)
												e.dataTransfer.effectAllowed = "move"
											}}
											className="cursor-grab font-mono text-xs active:cursor-grabbing"
										>
											@{u}
										</span>
										<MoveSelect
											username={u}
											currentCategoryId={OTHER_CATEGORY_ID}
											options={moveTargets}
											onPick={(tid) => moveUsernameToCategory(u, tid)}
										/>
									</div>
								))}
							</div>
						)}
					</section>

					<div className="space-y-3">
						<h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
							Categories
						</h3>
						{assignable.map(({ id, label }) => {
							const accounts = getEffectiveAccounts(id)
							return (
								<section
									key={id}
									{...droppableProps(id)}
									className={cn(
										"rounded-xl border border-dashed p-3 transition-colors",
										dropTarget === id
											? "border-primary bg-primary/5"
											: "border-border/60 bg-background",
									)}
								>
									<h4 className="mb-2 text-sm font-medium text-foreground">
										{label}
									</h4>
									{accounts.length === 0 ? (
										<p className="text-xs text-muted-foreground">
											No accounts — drop here or add in category edit.
										</p>
									) : (
										<div className="flex flex-wrap gap-2">
											{accounts.map((u) => (
												<div
													key={u}
													className="flex max-w-full items-center gap-1 rounded-lg border border-border/80 bg-muted/30 px-2 py-1"
												>
													<span
														draggable
														onDragStart={(e) => {
															e.dataTransfer.setData(DND_MIME, u)
															e.dataTransfer.setData("text/plain", u)
															e.dataTransfer.effectAllowed = "move"
														}}
														className="cursor-grab font-mono text-xs active:cursor-grabbing"
													>
														@{u}
													</span>
													<MoveSelect
														username={u}
														currentCategoryId={id}
														options={moveTargets}
														onPick={(tid) => moveUsernameToCategory(u, tid)}
													/>
												</div>
											))}
										</div>
									)}
								</section>
							)
						})}
					</div>
				</div>

				<div className="shrink-0 border-t border-border/80 px-4 py-3">
					<Button
						type="button"
						variant="secondary"
						className="w-full"
						onClick={() => onOpenChange(false)}
					>
						Done
					</Button>
				</div>
			</DialogContent>
		</Dialog>
	)
}
