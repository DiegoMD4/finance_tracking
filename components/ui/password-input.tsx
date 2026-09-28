"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { Eye, EyeOff } from "lucide-react"

interface PasswordInputProps extends React.ComponentProps<typeof Input> {
  containerClassName?: string
}

function PasswordInput({
  className,
  containerClassName,
  ...props
}: PasswordInputProps) {
  const [visible, setVisible] = React.useState(false)

  return (
    <div className={cn("relative", containerClassName)}>
      <Input
        type={visible ? "text" : "password"}
        className={cn("pr-8", className)}
        {...props}
      />
      <button
        type="button"
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
        tabIndex={-1}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => setVisible((visible) => !visible)}
        className="absolute inset-y-0 right-0 flex w-7 items-center justify-center text-muted-foreground transition-colors hover:text-foreground focus-visible:text-foreground"
      >
        {visible ? <EyeOff size={14} /> : <Eye size={14} />}
      </button>
    </div>
  )
}

export { PasswordInput }