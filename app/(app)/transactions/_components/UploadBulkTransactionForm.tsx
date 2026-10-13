"use client"

import { Dropzone } from "@/components/ui/dropzone"
import { FieldDescription } from "@/components/ui/field"

export function UploadBulkTransactionForm() {
  return (
    <form className="flex flex-row justify-center pt-4" autoComplete="off">
      <div className="flex w-full flex-col gap-1.5 pt-4">
        <FieldDescription>
          Upload a file with multiple transactions at once. You can preview and
          remove the file before submitting.
        </FieldDescription>
        <Dropzone name="file" maxFiles={1} label="Transactions file" />
      </div>
    </form>
  )
}
