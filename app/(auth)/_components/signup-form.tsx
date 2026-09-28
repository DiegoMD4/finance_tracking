"use client"

import { cn } from "@/lib/utils"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { PasswordInput } from "@/components/ui/password-input"

import { useActionState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { toast } from "sonner"

import { createUser } from "@/server/users/actions"

export function SignupForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const router = useRouter()
  const [state, formAction, isPending] = useActionState(createUser, null)

  useEffect(() => {
    if (!state) return

    if (state.success) {
      toast.success(state.message)
      router.push("/")
    } else {
      toast.error(state.message)
    }
  }, [state, router])

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Create your account</CardTitle>
          <CardDescription>
            Enter your details below to create your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={formAction}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="name">Full Name</FieldLabel>
                <Input
                  id="name"
                  name="name"
                  type="text"
                  placeholder="John Doe"
                  autoComplete="name"
                  defaultValue={state?.fields?.name}
                  aria-invalid={!!state?.error?.name}
                />
                <FieldError>{state?.error?.name}</FieldError>
              </Field>
              <Field>
                <FieldLabel htmlFor="email">Email</FieldLabel>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="m@example.com"
                  autoComplete="email"
                  defaultValue={state?.fields?.email}
                  aria-invalid={!!state?.error?.email}
                />
                <FieldError>{state?.error?.email}</FieldError>
              </Field>
              <Field>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="password">Password</FieldLabel>
                    <PasswordInput
                      id="password"
                      name="password"
                      autoComplete="new-password"
                      aria-invalid={!!state?.error?.password}
                    />
                    <FieldError>{state?.error?.password}</FieldError>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="confirmPassword">
                      Confirm Password
                    </FieldLabel>
                    <PasswordInput
                      id="confirmPassword"
                      name="confirmPassword"
                      autoComplete="new-password"
                      aria-invalid={!!state?.error?.confirmPassword}
                    />
                    <FieldError>{state?.error?.confirmPassword}</FieldError>
                  </Field>
                </div>
                <FieldDescription>
                  Must be at least 8 characters long.
                </FieldDescription>
              </Field>
              <Field>
                <Button
                  type="submit"
                  className="cursor-pointer"
                  disabled={isPending}
                >
                  {isPending ? "Creating account..." : "Create Account"}
                </Button>

                <FieldDescription className="text-center">
                  Already have an account? <Link href="/">Sign in</Link>
                </FieldDescription>
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
      <FieldDescription className="px-6 text-center">
        By clicking continue, you agree to our <a href="#">Terms of Service</a>{" "}
        and <a href="#">Privacy Policy</a>.
      </FieldDescription>
    </div>
  )
}
