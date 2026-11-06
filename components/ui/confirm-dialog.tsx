"use client"

import * as React from "react"

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: () => Promise<void> | void
  confirmVariant?: "destructive" | "outline" | "secondary" | "ghost" | "link"
  disabled?: boolean
  confirmLoadingLabel?: string
  contentClassName?: string
  autoClose?: boolean
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  onConfirm,
  confirmVariant = "destructive",
  disabled = false,
  confirmLoadingLabel = "Deleting...",
  contentClassName,
  autoClose = true,
}: ConfirmDialogProps) {
  const [isConfirming, setIsConfirming] = React.useState(false)

  const handleConfirm = async () => {
    setIsConfirming(true)
    try {
      await onConfirm()
      if (autoClose) {
        onOpenChange(false)
      }
    } catch (error) {
      console.error("ConfirmDialog error:", error)
    } finally {
      setIsConfirming(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={contentClassName}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose
            render={({ onClick: _onClick }) => (
              <Button
                variant="outline"
                disabled={disabled || isConfirming}
              >
                {cancelLabel}
              </Button>
            )}
          />
          <Button
            variant={confirmVariant}
            onClick={handleConfirm}
            disabled={disabled || isConfirming}
          >
            {isConfirming ? confirmLoadingLabel : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export type { ConfirmDialogProps }
