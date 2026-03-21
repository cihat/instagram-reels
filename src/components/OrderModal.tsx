"use client"

import { useEffect } from "react"
import { Calendar, Heart, ListOrdered } from "lucide-react"
import { cn } from "@/lib/utils"
import type { SortOption } from "@/lib/types"

const SORT_OPTIONS: { value: SortOption; label: string; icon: typeof Calendar }[] = [
	{ value: "relevance", label: "Default (search order)", icon: ListOrdered },
	{ value: "date_desc", label: "Date (newest first)", icon: Calendar },
	{ value: "date_asc", label: "Date (oldest first)", icon: Calendar },
	{ value: "likes_desc", label: "Likes (high → low)", icon: Heart },
	{ value: "likes_asc", label: "Likes (low → high)", icon: Heart },
]

interface OrderModalProps {
	open: boolean
	onClose: () => void
	value: SortOption
	onChange: (value: SortOption) => void
}

export function OrderModal({ open, onClose, value, onChange }: OrderModalProps) {
	useEffect(() => {
		if (!open) return
		const handleEscape = (e: KeyboardEvent) => {
			if (e.key === "Escape") onClose()
		}
		document.addEventListener("keydown", handleEscape)
		document.body.style.overflow = "hidden"
		return () => {
			document.removeEventListener("keydown", handleEscape)
			document.body.style.overflow = ""
		}
	}, [open, onClose])

	if (!open) return null

	return (
		<div
			className="fixed inset-0 z-100 flex items-center justify-center p-4"
			role="dialog"
			aria-modal="true"
			aria-labelledby="order-modal-title"
		>
			<div
				className="absolute inset-0 bg-black/50 backdrop-blur-sm"
				onClick={onClose}
				aria-hidden="true"
			/>
			<div className="relative w-full max-w-sm rounded-2xl border border-border bg-card p-4 shadow-xl">
				<h2 id="order-modal-title" className="mb-3 text-sm font-semibold text-foreground">
					Sort
				</h2>
				<ul className="flex flex-col gap-0.5">
					{SORT_OPTIONS.map((opt) => {
						const Icon = opt.icon
						const isSelected = value === opt.value
						return (
							<li key={opt.value}>
								<button
									type="button"
									onClick={() => {
										onChange(opt.value)
										onClose()
									}}
									className={cn(
										"flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors",
										isSelected
											? "bg-primary text-primary-foreground"
											: "text-foreground hover:bg-muted",
									)}
								>
									<Icon className="size-4 shrink-0" />
									{opt.label}
								</button>
							</li>
						)
					})}
				</ul>
			</div>
		</div>
	)
}
