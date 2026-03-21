"use client"

import type { Dispatch, SetStateAction } from "react"
import { createContext, useContext, useState } from "react"

interface PlayingVideoContextValue {
	playingId: string | null
	setPlayingId: (id: string | null) => void
	/** At most one grid or modal video may be unmuted at a time. */
	audibleMediaId: string | null
	setAudibleMediaId: Dispatch<SetStateAction<string | null>>
}

const PlayingVideoContext = createContext<PlayingVideoContextValue | null>(null)

export function PlayingVideoProvider({ children }: { children: React.ReactNode }) {
	const [playingId, setPlayingId] = useState<string | null>(null)
	const [audibleMediaId, setAudibleMediaId] = useState<string | null>(null)
	return (
		<PlayingVideoContext.Provider
			value={{ playingId, setPlayingId, audibleMediaId, setAudibleMediaId }}
		>
			{children}
		</PlayingVideoContext.Provider>
	)
}

export function usePlayingVideo() {
	const ctx = useContext(PlayingVideoContext)
	if (!ctx) throw new Error("usePlayingVideo must be used within PlayingVideoProvider")
	return ctx
}
