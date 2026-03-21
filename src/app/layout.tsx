import type { Metadata } from "next"
import "./globals.css"
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

export const metadata: Metadata = {
	title: "Kısa Videolar - Axiomism",
	description:
		"Axiomism Instagram kısa videoları (reels). Etiket, açıklama ve başlığa göre arayıp izleyin.",
	referrer: "no-referrer",
	icons: {
		icon: "/logo.png",
		apple: "/logo.png",
	},
}

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode
}>) {
	return (
		<html lang="tr" className={cn("font-sans", geist.variable)}>
			<body className="antialiased">{children}</body>
		</html>
	)
}
