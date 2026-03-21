"use client"

import { createContext, useContext } from "react"

/** Scroll container for the reels grid; used as IntersectionObserver root. */
export const ReelsScrollRootContext = createContext<HTMLElement | null>(null)

export function useReelsScrollRoot() {
	return useContext(ReelsScrollRootContext)
}
