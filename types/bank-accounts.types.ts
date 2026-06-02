export interface GetBankAccounts {
  success: boolean
  error?: string
  data: BankAccounts[]
}
export interface GetBankAccountById {
  success: boolean
  error?: string
  data?: BankAccounts 
}

export interface BankAccounts {
  updatedAt: Date | null
  createdAt: Date
  deletedAt: Date | null
  id: number
  accountNumber: string
  bankName: string
  bankAccountType: string | null
  userId: number
  accountCurrency: string | null
  accountEmail: string | null
}

export interface CreateBankAccount {
  success: boolean
  message: string
  error?: ErrorsCreateBankAccount
  fields: {
    bankName: string
    accountNumber: string
    accountCurrency: string
    accountEmail: string
    bankAccountType: string
  }
}
export interface UpdateBankAccount {
  success: boolean
  message: string
  error?: ErrorsCreateBankAccount
  fields: {
    bankName: string
    accountNumber: string
    accountCurrency: string
    accountEmail: string
    bankAccountType: string
  }
}
export type ErrorsCreateBankAccount = {
  bankName?: string
  accountNumber?: string
  bankAccountType?: string
  accountEmail?: string
  accountCurrency?: string
}

export type BankAccountActionState =
  | { success: boolean; message: string; error?: ErrorsCreateBankAccount }
  | null
  | undefined