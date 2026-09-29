import { Spinner } from "@/components/ui/spinner"

export default function Loading() {
  return (
    <div className="flex h-full w-full items-center justify-center justify-items-center">
      <Spinner className="text-primary size-15" />
    </div>
  )
}
