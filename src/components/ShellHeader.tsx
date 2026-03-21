"use client"

import { SidebarTrigger } from "@/components/ui/sidebar"
import { cn } from "@/lib/utils"

interface ShellHeaderProps {
	title: string
	className?: string
	/** Extra actions shown after the title (e.g. sort on mobile) */
	actions?: React.ReactNode
}

export function ShellHeader({ title, className, actions }: ShellHeaderProps) {
	return (
		<header
			className={cn(
				"flex h-12 shrink-0 items-center gap-2 border-b border-border/80 bg-background/95 px-2 backdrop-blur-sm z-30",
				className,
			)}
		>
			<SidebarTrigger />
			<h1 className="min-w-0 flex-1 truncate text-sm font-semibold tracking-tight">
				{title}
			</h1>
			{actions}
		</header>
	)
}
