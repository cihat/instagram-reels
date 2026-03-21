"use client"

import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog"
import {
	SourcesForm,
	type SourcesSubmitPayload,
} from "@/components/SourcesForm"

interface SourcesModalProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	/** Runs in the background as soon as the modal closes (status via toast) */
	onBackgroundSubmit: (payload: SourcesSubmitPayload) => void
}

export function SourcesModal({
	open,
	onOpenChange,
	onBackgroundSubmit,
}: SourcesModalProps) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent
				showCloseButton
				className="flex max-h-[min(92dvh,640px)] w-[min(96vw,440px)] max-w-[min(96vw,440px)] flex-col gap-0 overflow-hidden p-0 sm:max-w-md"
			>
				<DialogHeader className="shrink-0 border-b border-border/80 px-4 py-3 text-left">
					<DialogTitle>Source accounts</DialogTitle>
					<DialogDescription className="text-pretty">
						Add accounts and fetch metadata. The dialog closes right away; status shows
						in the toast area.
					</DialogDescription>
				</DialogHeader>
				<div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
					<SourcesForm
						onDelegatedSubmit={(payload) => {
							onOpenChange(false)
							onBackgroundSubmit(payload)
						}}
					/>
				</div>
			</DialogContent>
		</Dialog>
	)
}
