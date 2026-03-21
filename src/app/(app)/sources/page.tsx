import type { Metadata } from "next"
import { SourcesPage } from "@/components/SourcesPage"

export const metadata: Metadata = {
	title: "Source accounts",
	description:
		"Manage Instagram usernames and trigger server-side metadata fetch for your index.",
}

export default function SourcesRoutePage() {
	return <SourcesPage />
}
