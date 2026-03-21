import type { Metadata, Viewport } from "next"
import "./globals.css"
import { Geist } from "next/font/google"
import { cn } from "@/lib/utils"

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" })

export const viewport: Viewport = {
	width: "device-width",
	initialScale: 1,
	viewportFit: "cover",
	themeColor: [
		{ media: "(prefers-color-scheme: light)", color: "#ffffff" },
		{ media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
	],
}

export const metadata: Metadata = {
	title: {
		default: "Reels Search",
		template: "%s · Reels Search",
	},
	description:
		"Search and browse Instagram Reels from accounts you choose — by caption, tags, and filters.",
	referrer: "no-referrer",
	icons: {
		icon: [
			{ url: "/favicon.svg", type: "image/svg+xml" },
			{ url: "/logo.png", sizes: "512x512", type: "image/png" },
		],
		apple: "/apple-touch-icon.png",
	},
	appleWebApp: {
		capable: true,
		title: "Reels Search",
		statusBarStyle: "default",
	},
}

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode
}>) {
	return (
		<html lang="en" className={cn("font-sans", geist.variable)}>
			<body className="antialiased">{children}</body>
		</html>
	)
}
