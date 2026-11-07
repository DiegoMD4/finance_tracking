"use client"

import * as React from "react"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Trash2Icon } from "lucide-react"
import { Button } from "@/components/ui/button"

interface AlertDialogDestructiveProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  cancelLabel?: string
  actionLabel?: string
  onAction: () => Promise<void> | void
  disabled?: boolean
  actionLoadingLabel?: string
  contentClassName?: string
  autoClose?: boolean
}

export function AlertDialogDestructive({
  open,
  onOpenChange,
  title,
  description,
  cancelLabel = "Cancel",
  actionLabel = "Delete",
  onAction,
  disabled = false,
  actionLoadingLabel = "Deleting...",
  contentClassName,
  autoClose = true,
}: AlertDialogDestructiveProps) {
  const [isExecuting, setIsExecuting] = React.useState(false)

  const handleAction = async () => {
    setIsExecuting(true)
    try {
      await onAction()
      if (autoClose) {
        onOpenChange(false)
      }
    } catch (error) {
      console.error("AlertDialogDestructive error:", error)
    } finally {
      setIsExecuting(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className={contentClassName}>
        <AlertDialogHeader>
          <AlertDialogMedia className="flex h-10 w-10 items-center justify-center rounded-md bg-destructive/10 text-destructive">
            <Trash2Icon className="h-5 w-5" />
          </AlertDialogMedia>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription className="mt-2">{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="mt-6 pt-4 border-t border-border">
          <AlertDialogCancel
            onClick={() => onOpenChange(false)}
            disabled={disabled || isExecuting}
            className="w-auto min-w-[80px]"
          >
            {cancelLabel}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleAction}
            disabled={disabled || isExecuting}
            className="w-auto min-w-[80px]"
          >
            {isExecuting ? actionLoadingLabel : actionLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

export type { AlertDialogDestructiveProps }
