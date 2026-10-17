"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"
import FormTransaction from "../../_components/FormTransaction"
import { UploadBulkTransactionForm } from "../../_components/UploadBulkTransactionForm"
import type { BankAccounts } from "@/types/bank-accounts.types"
import type { Category } from "@/types/categories.types"

interface NewTransactionClientProps {
  bankAccounts: BankAccounts[]
  categories: Category[]
}

export function NewTransactionClient({
  bankAccounts,
  categories,
}: NewTransactionClientProps) {
  const [activeTab, setActiveTab] = useState<"individual" | "bulk">(
    "individual"
  )

  return (
    <div className="w-full">
      <div className="flex flex-col sm:flex-row gap-2 mb-6 w-full">
        <Button
          variant={activeTab === "individual" ? "default" : "outline"}
          onClick={() => setActiveTab("individual")}
          className="w-full sm:w-auto"
        >
          New transaction
        </Button>
        <Button
          variant={activeTab === "bulk" ? "default" : "outline"}
          onClick={() => setActiveTab("bulk")}
          className="w-full sm:w-auto"
        >
          Bulk upload (bank statement)
        </Button>
      </div>

      {activeTab === "individual" && (
        <div className="mt-4">
          <FormTransaction
            bankAccounts={bankAccounts}
            categories={categories}
          />
        </div>
      )}

      {activeTab === "bulk" && (
        <div className="mt-4">
          <UploadBulkTransactionForm
            bankAccounts={bankAccounts}
            categories={categories}
          />
        </div>
      )}
    </div>
  )
}
