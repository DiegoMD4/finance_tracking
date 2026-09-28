"use server"

import { signUpSchema } from "@/app/(auth)/schema"
import { db } from "@/db"
import { users } from "@/db/schema/schema"
import { CreateUser, UserActionState } from "@/types/users.types"
import { eq } from "drizzle-orm"
import bcrypt from "bcryptjs"
import { z } from "zod"

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