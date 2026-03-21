const ONBOARDING_KEY = "reels-interests-onboarding-v1"

export function isInterestsOnboardingComplete(): boolean {
	if (typeof window === "undefined") return true
	try {
		const raw = localStorage.getItem(ONBOARDING_KEY)
		if (!raw) return false
		const j = JSON.parse(raw) as { completed?: boolean }
		return j?.completed === true
	} catch {
		return false
	}
}

export function persistInterestsOnboardingComplete(): void {
	try {
		localStorage.setItem(
			ONBOARDING_KEY,
			JSON.stringify({ completed: true, v: 1 }),
		)
	} catch {
		// ignore
	}
}
