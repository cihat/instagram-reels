import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
	title: "Kısa Videolar - Axiomism",
	description:
		"Axiomism Instagram kısa videoları (reels). Etiket, açıklama ve başlığa göre arayıp izleyin.",
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
		<html lang="tr">
			<body className="antialiased">{children}</body>
		</html>
	)
}
