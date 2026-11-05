import { render, cleanup, fireEvent, waitFor, within } from "@testing-library/react"
import { describe, it, expect, vi, afterEach } from "vitest"
import React from "react"
import { loginUser, loginAsDemo } from "@/server/users/actions"
import { LoginForm } from "./login-form"

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

const mockLoginUser = vi.mocked(loginUser)
const mockLoginAsDemo = vi.mocked(loginAsDemo)

function renderForm(props?: React.ComponentProps<typeof LoginForm>) {
  return render(<LoginForm {...props} />)
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe("LoginForm (UI-06)", () => {
  it("renders email and password fields and login button", () => {
    renderForm()

    expect(document.getElementById("email")).toBeInTheDocument()
    expect(document.getElementById("password")).toBeInTheDocument()
    expect(within(document.body).getByRole("button", { name: /^login$/i })).toBeInTheDocument()
  })

  it("submits successfully and redirects to dashboard", async () => {
    const { container } = renderForm()

    fireEvent.change(document.getElementById("email") as Element, { target: { value: "test@example.com" } })
    fireEvent.change(document.getElementById("password") as Element, { target: { value: "password123" } })

    mockLoginUser.mockResolvedValueOnce({
      success: true,
      message: "Login successful",
      fields: { email: "test@example.com" },
    } as Awaited<ReturnType<typeof loginUser>>)

    const form = container.querySelector("form") as HTMLFormElement
    fireEvent.submit(form)

    await waitFor(() => expect(mockLoginUser).toHaveBeenCalled())
    await waitFor(() => expect(mockToastSuccess).toHaveBeenCalledWith("Login successful"))
    expect(mockPush).toHaveBeenCalledWith("/dashboard")
  })

  it("shows error toast on failed login", async () => {
    const { container } = renderForm()

    fireEvent.change(document.getElementById("email") as Element, { target: { value: "test@example.com" } })
    fireEvent.change(document.getElementById("password") as Element, { target: { value: "wrong" } })

    mockLoginUser.mockResolvedValueOnce({
      success: false,
      message: "Invalid credentials",
      error: { email: "Invalid credentials" },
      fields: { email: "test@example.com" },
    } as Awaited<ReturnType<typeof loginUser>>)

    const form = container.querySelector("form") as HTMLFormElement
    fireEvent.submit(form)

    await waitFor(() => expect(mockLoginUser).toHaveBeenCalled())
    await waitFor(() => expect(mockToastError).toHaveBeenCalled())
  })

  it("allows login as demo", async () => {
    renderForm()

    const demoButton = within(document.body).getByRole("button", { name: /try demo/i })
    fireEvent.click(demoButton)

    await waitFor(() => expect(mockLoginAsDemo).toHaveBeenCalled())
  })
})
