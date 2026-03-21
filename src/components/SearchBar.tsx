"use client"

import { useCallback } from "react"
import { ArrowUpDown, Loader2, Search, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

interface SearchBarProps {
	value: string
	onChange: (value: string) => void
	onSearch: () => void
	onOrderClick?: () => void
	pending?: boolean
	placeholder?: string
	className?: string
}

export function SearchBar({
	value,
	onChange,
	onSearch,
	onOrderClick,
	pending = false,
	placeholder = "Açıklama ara…",
	className,
}: SearchBarProps) {
	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent) => {
			if (e.key === "Enter") onSearch()
		},
		[onSearch],
	)

	return (
		<div
			className={cn(
				"relative flex gap-2 rounded-xl bg-card/95 backdrop-blur-sm p-2 shadow-lg border border-border/80",
				"transition-all duration-200",
				"focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/15",
				className,
			)}
		>
			<div className="relative flex-1 min-w-0">
				<Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground pointer-events-none shrink-0" />
				<Input
					type="text"
					value={value}
					onChange={(e) => onChange(e.target.value)}
					onKeyDown={handleKeyDown}
					placeholder={placeholder}
					className={cn(
						"pl-9 h-10 rounded-lg bg-background/80 border-border/80",
						"focus-visible:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:bg-background",
						"transition-all duration-200 placeholder:text-muted-foreground/80",
						value.length > 0 ? "pr-12" : "pr-3",
					)}
					aria-label="Arama"
				/>
				{value.length > 0 && (
					<button
						type="button"
						onClick={() => onChange("")}
						className="absolute right-0 top-1/2 -translate-y-1/2 w-11 h-11 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/80 touch-manipulation"
						aria-label="Temizle"
					>
						<X className="size-5" />
					</button>
				)}
			</div>
			{onOrderClick && (
				<Button
					type="button"
					variant="outline"
					size="icon"
					onClick={onOrderClick}
					className="hidden md:flex shrink-0 rounded-xl h-12 w-12 border-border/80"
					title="Sıralama"
					aria-label="Sıralama"
				>
					<ArrowUpDown className="size-5" />
				</Button>
			)}
			<Button
				type="button"
				onClick={onSearch}
				disabled={pending}
				className="rounded-lg h-10 px-5 font-medium shadow-sm min-w-13 justify-center"
			>
				{pending ? (
					<Loader2 className="size-4 animate-spin" aria-hidden />
				) : (
					"Ara"
				)}
			</Button>
		</div>
	)
}
