export interface CreateUser {
  success: boolean
  message: string
  error?: {
    name?: string
    email?: string
    password?: string
    confirmPassword?: string
  }
  fields: {
    name: string
    email: string
    password: string
    confirmPassword: string
  }
}

export type UserActionState = CreateUser | null | undefined