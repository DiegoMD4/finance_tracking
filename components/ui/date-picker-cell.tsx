"use client"

import * as React from "react"
import { format, parseISO } from "date-fns"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { CalendarDays } from "lucide-react"

interface DatePickerCellProps {
  value: string
  onChange: (date: string) => void
  className?: string
}

export function DatePickerCell({
  value,
  onChange,
  className,
}: DatePickerCellProps) {
  const [open, setOpen] = React.useState(false)
  const selectedDate = React.useMemo(
    () => (value ? parseISO(value) : undefined),
    [value]
  )

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          type="button"
          className={className ?? "h-8 w-full border-none bg-transparent p-0 text-xs font-mono focus:ring-0 justify-between"}
        >
          <span>{value ? format(parseISO(value), "dd/MM/yyyy") : "Select date"}</span>
          <CalendarDays className="ml-auto" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto overflow-hidden p-0" align="start">
        {selectedDate ? (
          <Calendar
            mode="single"
            selected={selectedDate}
            defaultMonth={selectedDate}
            captionLayout="dropdown"
            onSelect={(date) => {
              if (!date) return
              const formatted = format(date, "yyyy-MM-dd")
              onChange(formatted)
              setOpen(false)
            }}
          />
        ) : (
          <Calendar
            mode="single"
            defaultMonth={new Date()}
            captionLayout="dropdown"
            onSelect={(date) => {
              if (!date) return
              const formatted = format(date, "yyyy-MM-dd")
              onChange(formatted)
              setOpen(false)
            }}
          />
        )}
      </PopoverContent>
    </Popover>
  )
}

