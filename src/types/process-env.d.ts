/** Yerel .env.local ve Cloudflare Workers secrets / vars */
declare namespace NodeJS {
	interface ProcessEnv {
		FETCH_TRIGGER_SECRET?: string
		/** Browser-style Cookie header (sessionid, csrftoken, …) */
		INSTAGRAM_COOKIES?: string
	}
}
