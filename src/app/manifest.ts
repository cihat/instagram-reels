import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
	return {
		name: "Reels Search",
		short_name: "Reels Search",
		description:
			"Search and browse Instagram Reels from accounts you choose — by caption, tags, and filters.",
		start_url: "/",
		display: "standalone",
		background_color: "#ffffff",
		theme_color: "#ffffff",
		icons: [
			{
				src: "/logo.png",
				sizes: "512x512",
				type: "image/png",
				purpose: "any",
			},
			{
				src: "/logo-maskable.png",
				sizes: "512x512",
				type: "image/png",
				purpose: "maskable",
			},
		],
	}
}
