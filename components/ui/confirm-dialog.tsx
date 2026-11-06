"use client"

import * as React from "react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

interface ConfirmDialogProps {
  /** Controla si el modal está abierto */
  open: boolean
  /** Callback cuando cambia el estado de apertura */
  onOpenChange: (open: boolean) => void
  /** Título del modal */
  title: string
  /** Descripción / cuerpo del modal */
  description: string
  /** Texto del botón de confirmar */
  confirmLabel?: string
  /** Texto del botón de cancelar */
  cancelLabel?: string
  /** Función que se ejecuta al confirmar (async) */
  onConfirm: () => Promise<void> | void
  /** Variante del botón de confirmar */
  confirmVariant?: "destructive" | "outline" | "secondary" | "ghost" | "link"
  /** Deshabilita ambos botones (para estados de carga) */
  disabled?: boolean
  /** Texto del botón de confirmar mientras se está ejecutando onConfirm */
  confirmLoadingLabel?: string
  /** Clases adicionales para el content del dialog */
  contentClassName?: string
  /** Si es true, el dialog se cierra automáticamente tras confirmar exitosamente */
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
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" disabled={disabled}>
          <span className="sr-only">Open confirm dialog</span>
        </Button>
      </DialogTrigger>
      <DialogContent className={contentClassName}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={disabled || isConfirming}
          >
            {cancelLabel}
          </Button>
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
