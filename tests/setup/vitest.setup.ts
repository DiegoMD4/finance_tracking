import { vi } from "vitest"
import "@testing-library/jest-dom/vitest"

// Global mocks for ui (jsdom) tests
vi.mock("@/db", () => ({
  db: {},
}))

vi.mock("@/server/bank-accounts/actions", () => ({
  createBankAccount: vi.fn(),
  updateBankAccount: vi.fn(),
  deleteBankAccount: vi.fn(),
  checkDuplicateAccount: vi.fn(),
}))

vi.mock("@/server/categories/actions", () => ({
  createCategory: vi.fn(),
  updateCategory: vi.fn(),
  deleteCategory: vi.fn(),
}))

vi.mock("@/server/transactions/actions", () => ({
  createTransaction: vi.fn(),
  updateTransaction: vi.fn(),
  createBulkTransactions: vi.fn(),
  deleteTransaction: vi.fn(),
}))

vi.mock("@/server/users/actions", () => ({
  updateDefaultCurrency: vi.fn(),
  loginUser: vi.fn(),
  loginAsDemo: vi.fn(),
  createUser: vi.fn(),
  logout: vi.fn(),
  getSessionStatus: vi.fn(),
}))

// Polyfills for jsdom
Object.defineProperty(window, "matchMedia", {
  writable: true,
  configurable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
})

globalThis.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

if (typeof HTMLElement.prototype.scrollIntoView === "undefined") {
  HTMLElement.prototype.scrollIntoView = function () {}
}

if (typeof HTMLElement.prototype.hasPointerCapture === "undefined") {
  HTMLElement.prototype.hasPointerCapture = () => false
}
if (typeof HTMLElement.prototype.setPointerCapture === "undefined") {
  HTMLElement.prototype.setPointerCapture = function () {}
}
if (typeof HTMLElement.prototype.releasePointerCapture === "undefined") {
  HTMLElement.prototype.releasePointerCapture = function () {}
}
