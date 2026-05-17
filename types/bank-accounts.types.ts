export interface BankAccounts{
     
    updatedAt: Date | null;
    createdAt: Date;
    deletedAt: Date | null;
    id: number;
    accountNumber: string;
    bankName: string;
    bankAccountType: string | null;
    userId: number;
}