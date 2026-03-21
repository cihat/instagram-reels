import type { NextConfig } from "next"
import withPWAInit from "@ducanh2912/next-pwa"
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare"

const withPWA = withPWAInit({
	dest: "public",
	disable: process.env.NODE_ENV === "development",
	register: true,
	scope: "/",
})

const nextConfig: NextConfig = {
	async redirects() {
		return [{ source: "/kaynaklar", destination: "/sources", permanent: true }]
	},
}

initOpenNextCloudflareForDev()

// Skip the PWA webpack plugin in development so `next dev` can use Turbopack (Next.js 16 default).
export default process.env.NODE_ENV === "development"
	? nextConfig
	: withPWA(nextConfig)
