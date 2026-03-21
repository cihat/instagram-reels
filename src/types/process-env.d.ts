/** Yerel .env.local ve Cloudflare Workers secrets / vars */
declare namespace NodeJS {
	interface ProcessEnv {
		FETCH_TRIGGER_SECRET?: string
		GITHUB_REPO_OWNER?: string
		GITHUB_REPO?: string
		GITHUB_ACTIONS_PAT?: string
	}
}
