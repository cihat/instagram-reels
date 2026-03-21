"use client"

import { memo, useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog"
import { useCategoryFilter } from "@/contexts/CategoryFilterContext"
import { enqueueMetadataFetchToast } from "@/lib/metadata-fetch-toast"
import {
	isInterestsOnboardingComplete,
	persistInterestsOnboardingComplete,
} from "@/lib/onboarding-storage"
import {
	REEL_CATEGORIES,
	getDefaultAccountsForBuiltinCategory,
} from "@/lib/reel-categories"
import { cn } from "@/lib/utils"

const OnboardingChip = memo(function OnboardingChip({
	label,
	selected,
	onToggle,
	id,
}: {
	id: string
	label: string
	selected: boolean
	onToggle: (id: string) => void
}) {
	return (
		<button
			type="button"
			onClick={() => onToggle(id)}
			className={cn(
				"rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
				selected
					? "border-primary bg-primary text-primary-foreground"
					: "border-border bg-background text-muted-foreground hover:bg-muted/80 hover:text-foreground",
			)}
			aria-pressed={selected}
		>
			{label}
		</button>
	)
})

export function InterestOnboardingModal() {
	const router = useRouter()
	const {
		setAccountsForCategory,
		categoryFilterReady,
		bumpIndexEpoch,
	} = useCategoryFilter()
	const [open, setOpen] = useState(false)
	const [selected, setSelected] = useState<Set<string>>(() => new Set())

	useEffect(() => {
		if (!categoryFilterReady) return
		if (isInterestsOnboardingComplete()) return
		setSelected(new Set())
		setOpen(true)
	}, [categoryFilterReady])

	const toggle = useCallback((id: string) => {
		setSelected((prev) => {
			const next = new Set(prev)
			if (next.has(id)) next.delete(id)
			else next.add(id)
			return next
		})
	}, [])

	const handleOpenChange = useCallback((next: boolean) => {
		setOpen(next)
		if (!next) persistInterestsOnboardingComplete()
	}, [])

	const handleContinue = useCallback(() => {
		if (selected.size === 0) return
		for (const { id } of REEL_CATEGORIES) {
			if (selected.has(id)) {
				setAccountsForCategory(id, getDefaultAccountsForBuiltinCategory(id))
			} else {
				setAccountsForCategory(id, [])
			}
		}
		for (const { id } of REEL_CATEGORIES) {
			if (!selected.has(id)) continue
			const accounts = getDefaultAccountsForBuiltinCategory(id)
			enqueueMetadataFetchToast(accounts, {
				onSuccess: bumpIndexEpoch,
				onSessionError: () => router.push("/sources"),
			})
		}
		handleOpenChange(false)
	}, [selected, setAccountsForCategory, bumpIndexEpoch, router, handleOpenChange])

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogContent showCloseButton={false} className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>What are you into?</DialogTitle>
					<DialogDescription className="text-pretty">
						Choose the topics you care about — nothing is pre-selected. When you
						continue, each selected topic loads curated Instagram accounts in the
						background; on phones, progress toasts appear compactly at the bottom.
					</DialogDescription>
				</DialogHeader>
				<div className="max-h-[min(50vh,22rem)] overflow-y-auto flex flex-wrap gap-2 py-1 pr-1">
					{REEL_CATEGORIES.map(({ id, label }) => (
						<OnboardingChip
							key={id}
							id={id}
							label={label}
							selected={selected.has(id)}
							onToggle={toggle}
						/>
					))}
				</div>
				<DialogFooter className="flex-col gap-2 sm:flex-col">
					<Button
						type="button"
						className="w-full"
						disabled={selected.size === 0}
						onClick={handleContinue}
					>
						Continue & fetch
					</Button>
					<Button
						type="button"
						variant="ghost"
						className="w-full text-muted-foreground"
						onClick={() => handleOpenChange(false)}
					>
						Skip for now
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}
