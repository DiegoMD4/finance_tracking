"use server"

import { signInSchema, SignInFields, signUpSchema } from "@/app/(auth)/schema"
import { db } from "@/db"
import { users } from "@/db/schema/schema"
import { setSessionCookie, clearSessionCookie } from "@/lib/jwt"
import { CreateUser, LoginUser, UserActionState } from "@/types/users.types"
import { eq } from "drizzle-orm"
import bcrypt from "bcryptjs"
import { z } from "zod"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

const DEMO_USER_ID = 1

export const createUser = async (
  prevState: UserActionState,
  formData: FormData
): Promise<CreateUser> => {
  const rawFields = {
    name: formData.get("name")?.toString() || "",
    email: formData.get("email")?.toString() || "",
    password: formData.get("password")?.toString() || "",
    confirmPassword: formData.get("confirmPassword")?.toString() || "",
  }

  const validatedFields = signUpSchema.safeParse(rawFields)

  if (!validatedFields.success) {
    const fieldErrors = z.treeifyError(validatedFields.error)
    return {
      success: false,
      message: "Invalid form data",
      error: {
        name: fieldErrors.properties?.name?.errors[0],
        email: fieldErrors.properties?.email?.errors[0],
        password: fieldErrors.properties?.password?.errors[0],
        confirmPassword: fieldErrors.properties?.confirmPassword?.errors[0],
      },
      fields: rawFields,
    }
  }

  const { name, email, password } = validatedFields.data

  const existingUser = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .then((res) => res[0])

  if (existingUser) {
    return {
      success: false,
      message: "Validation error",
      error: { email: "This email is already registered" },
      fields: rawFields,
    }
  }

  const hashedPassword = await bcrypt.hash(password, 10)

  try {
    await db.insert(users).values({
      name,
      email,
      password: hashedPassword,
    })

    return {
      success: true,
      message: "Account created successfully",
      fields: rawFields,
    }
  } catch (error) {
    console.error("❌ Error creating user:", error)

    const errorMessage =
      error instanceof Error ? error.message : "Unknown error"
    return { success: false, message: errorMessage, fields: rawFields }
  }
}

export const loginUser = async (
  prevState: UserActionState,
  formData: FormData
): Promise<LoginUser> => {
  const rawFields: SignInFields = {
    email: formData.get("email")?.toString() || "",
    password: formData.get("password")?.toString() || "",
  }

  const validatedFields = signInSchema.safeParse(rawFields)

  if (!validatedFields.success) {
    const fieldErrors = z.treeifyError(validatedFields.error)
    return {
      success: false,
      message: "Invalid form data",
      error: {
        email: fieldErrors.properties?.email?.errors[0],
        password: fieldErrors.properties?.password?.errors[0],
      },
      fields: rawFields,
    }
  }

  const { email, password } = validatedFields.data

  try {
    const user = await db
      .select({ id: users.id, password: users.password, userName: users.name })
      .from(users)
      .where(eq(users.email, email))
      .then((res) => res[0])

    const passwordMatches = user
      ? await bcrypt.compare(password, user.password)
      : false

    if (!user || !passwordMatches) {
      return {
        success: false,
        message: "Invalid email or password",
        fields: rawFields,
      }
    }

    await setSessionCookie(user.id)
    revalidatePath("/dashboard")
    return {
      success: true,
      message: "Logged in successfully",
      fields: rawFields,
    }
  } catch (error) {
    console.error("❌ Error logging in:", error)

    const errorMessage =
      error instanceof Error ? error.message : "Unknown error"
    return { success: false, message: errorMessage, fields: rawFields }
  }
}

export async function loginAsDemo(): Promise<void> {
  await setSessionCookie(DEMO_USER_ID)
  revalidatePath("/dashboard")
  redirect("/dashboard")
}

export async function logout(): Promise<void> {
  await clearSessionCookie()
  redirect("/")
}
