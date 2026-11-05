import { render, cleanup, fireEvent, waitFor, within } from "@testing-library/react"
import { describe, it, expect, vi, afterEach } from "vitest"
import React from "react"
import { createUser } from "@/server/users/actions"
import { SignupForm } from "./signup-form"

const { mockPush, mockToastSuccess, mockToastError } = vi.hoisted(() => ({
  mockPush: vi.fn(),
  mockToastSuccess: vi.fn(),
  mockToastError: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({ push: mockPush })),
}))

vi.mock("sonner", () => ({
  toast: { success: mockToastSuccess, error: mockToastError },
}))

const mockCreateUser = vi.mocked(createUser)

function renderForm(props?: React.ComponentProps<typeof SignupForm>) {
  return render(<SignupForm {...props} />)
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe("SignupForm (UI-07)", () => {
  it("renders name, email, password and confirm password fields", () => {
    renderForm()

    expect(document.getElementById("name")).toBeInTheDocument()
    expect(document.getElementById("email")).toBeInTheDocument()
    expect(document.getElementById("password")).toBeInTheDocument()
    expect(document.getElementById("confirmPassword")).toBeInTheDocument()
    expect(within(document.body).getByRole("button", { name: /create account/i })).toBeInTheDocument()
  })

  it("submits successfully and redirects to home", async () => {
    const { container } = renderForm()

    fireEvent.change(document.getElementById("name") as Element, { target: { value: "John Doe" } })
    fireEvent.change(document.getElementById("email") as Element, { target: { value: "john@example.com" } })
    fireEvent.change(document.getElementById("password") as Element, { target: { value: "password123" } })
    fireEvent.change(document.getElementById("confirmPassword") as Element, { target: { value: "password123" } })

    mockCreateUser.mockResolvedValueOnce({
      success: true,
      message: "Account created",
      fields: { name: "John Doe", email: "john@example.com" },
    } as Awaited<ReturnType<typeof createUser>>)

    const form = container.querySelector("form") as HTMLFormElement
    fireEvent.submit(form)

    await waitFor(() => expect(mockCreateUser).toHaveBeenCalled())
    await waitFor(() => expect(mockToastSuccess).toHaveBeenCalledWith("Account created"))
    expect(mockPush).toHaveBeenCalledWith("/")
  })

  it("shows error toast on failed signup", async () => {
    const { container } = renderForm()

    fireEvent.change(document.getElementById("name") as Element, { target: { value: "John Doe" } })
    fireEvent.change(document.getElementById("email") as Element, { target: { value: "john@example.com" } })
    fireEvent.change(document.getElementById("password") as Element, { target: { value: "pass" } })
    fireEvent.change(document.getElementById("confirmPassword") as Element, { target: { value: "pass" } })

    mockCreateUser.mockResolvedValueOnce({
      success: false,
      message: "Validation error",
      error: { password: "Password too short" },
      fields: { name: "John Doe", email: "john@example.com" },
    } as Awaited<ReturnType<typeof createUser>>)

    const form = container.querySelector("form") as HTMLFormElement
    fireEvent.submit(form)

    await waitFor(() => expect(mockCreateUser).toHaveBeenCalled())
    await waitFor(() => expect(mockToastError).toHaveBeenCalled())
  })
})
