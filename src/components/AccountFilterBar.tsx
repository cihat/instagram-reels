"use client"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface AccountFilterBarProps {
	usernames: string[]
	/** Reels per username for the current category + search query (same basis as the grid). */
	counts?: Record<string, number>
	selected: string[]
	onChange: (next: string[]) => void
	className?: string
}

export function AccountFilterBar({
	usernames,
	counts,
	selected,
	onChange,
	className,
}: AccountFilterBarProps) {
	if (usernames.length === 0) return null

	const isAll = selected.length === 0
	const setSelected = (u: string) => {
		const has = selected.includes(u)
		if (has) onChange(selected.filter((x) => x !== u))
		else onChange([...selected, u])
	}

	return (
		<div
			className={cn(
				"shrink-0 border-b border-border/70 bg-background/95 px-2 py-2 backdrop-blur-sm",
				className,
			)}
		>
			<p className="mb-1.5 px-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
				Account
			</p>
			<div className="flex gap-1.5 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
				<Button
					type="button"
					variant={isAll ? "default" : "outline"}
					size="sm"
					className="h-8 shrink-0 rounded-full px-3 text-xs"
					onClick={() => onChange([])}
				>
					All
				</Button>
				{usernames.map((name) => {
					const active = selected.includes(name)
					const n = counts?.[name]
					const title =
						n !== undefined ? `@${name} — ${n} reels` : `@${name}`
					return (
						<Button
							key={name}
							type="button"
							variant={active ? "default" : "outline"}
							size="sm"
							className="h-8 shrink-0 rounded-full px-3 text-xs font-normal"
							onClick={() => setSelected(name)}
							title={title}
						>
							<span className="flex items-center gap-1.5">
								<span>@{name}</span>
								{n !== undefined ? (
									<span
										className={cn(
											"tabular-nums text-[11px]",
											active
												? "text-primary-foreground/85"
												: "text-muted-foreground",
										)}
									>
										{n}
									</span>
								) : null}
							</span>
						</Button>
					)
				})}
			</div>
		</div>
	)
}
