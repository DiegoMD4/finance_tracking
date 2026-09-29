import { z } from "zod"

export const signUpSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, { error: "A name is required" })
      .max(255, { error: "The name is too long" }),
    email: z
      /*  .email() */
      /*  .trim()
      .min(1, { error: "An email is required" })
      .max(255, { error: "The email is too long" }) */
      .email({ error: "Please enter a valid email" }),
    password: z
      .string()
      .min(8, { error: "Password must be at least 8 characters" })
      .max(255, { error: "The password is too long" }),
    confirmPassword: z
      .string()
      .min(1, { error: "Please confirm your password" }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    error: "Passwords do not match",
    path: ["confirmPassword"],
  })

export type SignUpFields = z.infer<typeof signUpSchema>

export const signInSchema = z.object({
  email: z.email(),
  password: z.string().trim().min(1, {error: "Please enter your password"}),
})

export type SignInFields = z.infer<typeof signInSchema>
