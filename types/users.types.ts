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

export interface LoginUser {
  success: boolean
  message: string
  error?: {
    email?: string
    password?: string
  }
  fields: {
    email: string
    password: string
  }
}

export interface ServerUser {
  id: number
  name: string
  email: string
}

export type UserActionState = CreateUser | LoginUser | null | undefined