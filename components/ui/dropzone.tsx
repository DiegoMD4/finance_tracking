"use client"

import * as React from "react"
import { File as FileIcon, Upload, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field"
import { cn } from "@/lib/utils"

function formatFileSize(bytes: number) {
  if (bytes === 0) return "0 B"

  const units = ["B", "KB", "MB", "GB"]
  const index = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1
  )
  const value = bytes / 1024 ** index

  return `${value.toFixed(index === 0 ? 0 : 1)} ${units[index]}`
}

function acceptsFile(file: File, accept?: string) {
  if (!accept || !accept.trim()) return true

  const tokens = accept
    .split(",")
    .map((token) => token.trim().toLowerCase())
    .filter(Boolean)

  if (tokens.length === 0) return true

  return tokens.some((token) => {
    if (token.startsWith(".")) {
      return file.name.toLowerCase().endsWith(token)
    }

    if (token.endsWith("/*")) {
      return file.type.toLowerCase().startsWith(token.slice(0, -1))
    }

    return file.type.toLowerCase() === token
  })
}

interface DropzoneProps {
  name: string
  maxFiles?: number
  accept?: string
  disabled?: boolean
  required?: boolean
  className?: string
  label?: React.ReactNode
  description?: React.ReactNode
  errors?: Array<{ message?: string } | undefined>
  onChange?: (files: File[]) => void
}

function Dropzone({
  name,
  maxFiles = 1,
  accept,
  disabled = false,
  required,
  className,
  label,
  description,
  errors,
  onChange,
}: DropzoneProps) {
  const inputRef = React.useRef<HTMLInputElement>(null)
  const inputId = React.useId()
  const [files, setFiles] = React.useState<File[]>([])
  const [isDragging, setIsDragging] = React.useState(false)
  const skipInitialSync = React.useRef(true)

  React.useEffect(() => {
    const input = inputRef.current
    if (input) {
      try {
        const transfer = new DataTransfer()
        for (const file of files) {
          transfer.items.add(file)
        }
        input.files = transfer.files
      } catch {
        input.value = ""
      }
    }

    if (skipInitialSync.current) {
      skipInitialSync.current = false
      return
    }

    onChange?.(files)
  }, [files, onChange])

  const addFiles = React.useCallback(
    (incoming: File[]) => {
      if (disabled || incoming.length === 0) return

      setFiles((current) => {
        const accepted = incoming.filter((file) => acceptsFile(file, accept))
        if (accepted.length === 0) return current

        if (maxFiles === 1) {
          return [accepted[0]]
        }

        const available = Math.max(0, maxFiles - current.length)
        return [...current, ...accepted.slice(0, available)]
      })
    },
    [accept, disabled, maxFiles]
  )

  const removeFile = (index: number) => {
    setFiles((current) =>
      current.filter((_, fileIndex) => fileIndex !== index)
    )
  }

  const openPicker = () => {
    if (disabled) return
    inputRef.current?.click()
  }

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    if (!disabled) setIsDragging(true)
  }

  const handleDragEnter = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    if (!disabled) setIsDragging(true)
  }

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setIsDragging(false)
    if (!disabled && event.dataTransfer.files.length > 0) {
      addFiles(Array.from(event.dataTransfer.files))
    }
  }

  return (
    <Field>
      {label && <FieldLabel htmlFor={inputId}>{label}</FieldLabel>}
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        name={name}
        accept={accept}
        multiple={maxFiles !== 1}
        required={required}
        disabled={disabled}
        className="sr-only w-px!"
        onChange={(event) => {
          if (event.target.files?.length) {
            addFiles(Array.from(event.target.files))
          }
        }}
      />
      <div className="flex w-full flex-col gap-1.5">
        <div
          data-slot="dropzone"
          onClick={openPicker}
          onDragOver={handleDragOver}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={cn(
            "group flex min-h-28 cursor-pointer flex-col items-center justify-center gap-2 rounded-none border-2 border-dashed border-input bg-background px-4 py-6 text-center text-xs text-muted-foreground outline-none transition-colors",
            "hover:border-primary/50 hover:bg-muted/50 focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50",
            "disabled:cursor-not-allowed disabled:opacity-50",
            isDragging && "border-primary bg-muted",
            disabled && "pointer-events-none opacity-50",
            className
          )}
        >
          <Upload
            size={20}
            strokeWidth={1.5}
            aria-hidden="true"
            className="text-muted-foreground"
          />
          <span>Drag and drop your file here</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled}
            className="cursor-pointer"
            onClick={(event) => {
              event.stopPropagation()
              openPicker()
            }}
          >
            Browse files
          </Button>
          {maxFiles > 1 && (
            <span className="text-[10px]">Up to {maxFiles} files</span>
          )}
        </div>

        {files.length > 0 && (
          <ul data-slot="dropzone-list" className="flex w-full flex-col gap-1.5">
            {files.map((file, index) => (
              <li
                key={`${file.name}-${file.lastModified}-${file.size}`}
                className="flex h-8 w-full items-center gap-2 rounded-none border border-input bg-background px-2.5 text-xs dark:bg-input/30"
              >
                <FileIcon
                  size={14}
                  aria-hidden="true"
                  className="shrink-0 text-muted-foreground"
                />
                <span className="min-w-0 flex-1 truncate font-medium text-foreground">
                  {file.name}
                </span>
                <span className="shrink-0 text-muted-foreground">
                  {formatFileSize(file.size)}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  disabled={disabled}
                  aria-label={`Remove ${file.name}`}
                  className="shrink-0"
                  onClick={() => removeFile(index)}
                >
                  <X />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {description && <FieldDescription>{description}</FieldDescription>}
      <FieldError errors={errors} />
    </Field>
  )
}

export { Dropzone }
export type { DropzoneProps }