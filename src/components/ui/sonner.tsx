"use client"

import {
	CircleCheck,
	Info,
	Loader2,
	OctagonX,
	TriangleAlert,
} from "lucide-react"
import { useSyncExternalStore } from "react"
import { Toaster as Sonner, type ToasterProps } from "sonner"

const MOBILE_TOAST_MQ = "(max-width: 767px)"

function subscribeMobileMq(onStoreChange: () => void) {
	const mq = window.matchMedia(MOBILE_TOAST_MQ)
	mq.addEventListener("change", onStoreChange)
	return () => mq.removeEventListener("change", onStoreChange)
}

function getMobileMqSnapshot() {
	return window.matchMedia(MOBILE_TOAST_MQ).matches
}

function getMobileMqServerSnapshot() {
	return false
}

const Toaster = ({ ...props }: ToasterProps) => {
	const mobileLayout = useSyncExternalStore(
		subscribeMobileMq,
		getMobileMqSnapshot,
		getMobileMqServerSnapshot,
	)

	return (
		<Sonner
			theme="system"
			position={mobileLayout ? "bottom-center" : "top-right"}
			className="toaster group"
			visibleToasts={mobileLayout ? 4 : 6}
			/**
			 * bottom-center varsayılanı ['bottom','center'] üretir; 'center' yatay swipe’ı
			 * tanımaz, 'top' olmadığı için yukarı kaydırma da yok. Mobilde dört yönde kaydırınca kapansın.
			 */
			swipeDirections={
				mobileLayout ? ["top", "bottom", "left", "right"] : undefined
			}
			mobileOffset={{
				bottom: "max(0.75rem, env(safe-area-inset-bottom, 0px))",
			}}
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
