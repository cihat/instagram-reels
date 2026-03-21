"use client"

import { createContext, useContext, useState } from "react"

interface PlayingVideoContextValue {
	playingId: string | null
	setPlayingId: (id: string | null) => void
}

const PlayingVideoContext = createContext<PlayingVideoContextValue | null>(null)

export function PlayingVideoProvider({ children }: { children: React.ReactNode }) {
	const [playingId, setPlayingId] = useState<string | null>(null)
	return (
		<PlayingVideoContext.Provider value={{ playingId, setPlayingId }}>
			{children}
		</PlayingVideoContext.Provider>
	)
}

export function usePlayingVideo() {
	const ctx = useContext(PlayingVideoContext)
	if (!ctx) throw new Error("usePlayingVideo must be used within PlayingVideoProvider")
	return ctx
}
