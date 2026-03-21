import type { Metadata } from "next"
import { ReelsHome } from "@/components/ReelsHome"

export const metadata: Metadata = {
	title: "Reels",
	description:
		"Search and browse indexed Instagram Reels by caption, tags, and accounts.",
}

export default function ReelsPage() {
	return <ReelsHome />
}
