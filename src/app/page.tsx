import type { Metadata } from "next"
import { LandingPage } from "@/components/LandingPage"

export const metadata: Metadata = {
	title: "Reels Search",
	description:
		"What Reels Search is, how indexing and search work, and why it exists — then open the app.",
}

export default function Home() {
	return <LandingPage />
}
