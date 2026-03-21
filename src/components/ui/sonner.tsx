"use client"

import {
	CircleCheck,
	Info,
	Loader2,
	OctagonX,
	TriangleAlert,
} from "lucide-react"
import { Toaster as Sonner, type ToasterProps } from "sonner"

const Toaster = ({ ...props }: ToasterProps) => {
	return (
		<Sonner
			theme="system"
			position="top-right"
			className="toaster group"
			icons={{
				success: <CircleCheck className="size-4" aria-hidden />,
				info: <Info className="size-4" aria-hidden />,
				warning: <TriangleAlert className="size-4" aria-hidden />,
				error: <OctagonX className="size-4" aria-hidden />,
				loading: <Loader2 className="size-4 animate-spin" aria-hidden />,
			}}
			style={
				{
					"--normal-bg": "var(--popover)",
					"--normal-text": "var(--popover-foreground)",
					"--normal-border": "var(--border)",
					"--border-radius": "var(--radius)",
				} as React.CSSProperties
			}
			toastOptions={{
				classNames: {
					toast: "cn-toast",
				},
			}}
			{...props}
		/>
	)
}

export { Toaster }
