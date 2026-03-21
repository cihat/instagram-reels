import type { Metadata } from "next"
import { SourcesPage } from "@/components/SourcesPage"

export const metadata: Metadata = {
	title: "Kaynak hesaplar",
	description:
		"Takip edilen Instagram hesapları; reels metadata çekimini tetikleme (video yok).",
}

export default function KaynaklarPage() {
	return <SourcesPage />
}
