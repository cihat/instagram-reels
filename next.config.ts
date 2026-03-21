import type { NextConfig } from "next"
import withPWAInit, { runtimeCaching as pwaRuntimeCaching } from "@ducanh2912/next-pwa"
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare"

const withPWA = withPWAInit({
	dest: "public",
	disable: process.env.NODE_ENV === "development",
	register: true,
	scope: "/",
	// Bypass stale /api cache for Instagram thumbnails (must match before generic /api/ rule).
	workboxOptions: {
		runtimeCaching: [
			{
				urlPattern: ({
					url,
					request,
				}: {
					url: URL
					request: Request
				}) =>
					request.method === "GET" &&
					url.pathname.startsWith("/api/image-proxy"),
				handler: "NetworkOnly",
			},
			...pwaRuntimeCaching,
		],
	},
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
