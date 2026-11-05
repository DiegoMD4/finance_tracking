# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Individuals managing their own personal finances. Primary job: track income, expenses, and categories; visualize spending trends; keep bank accounts and balances under control in one place.

## Product Purpose

A modern, high-performance, responsive fullstack web application to take control of personal finances. Track income, expenses, categories, and visualize spending trends with interactive charts. Built with Next.js 16, TypeScript, Tailwind CSS, shadcn/ui, and MySQL.

## Positioning

Personal-finance tracking for individuals, built around bank accounts, categorized income/expense transactions, and chart-based spending visualization, with multi-currency support (transaction currency vs. default currency, exchange rates, amounts converted to default currency).

## Operating Context

Web app used to review a dashboard (net balance, monthly income/expense, funds distribution, daily average), manage bank accounts, categorize transactions, and review transaction history. Server Actions handle create/update/delete; Drizzle ORM migrations seed the MySQL schema (users, bankAccounts, transactions, categories, currencies). Default currency is HNL. No authentication yet: userId is hardcoded to 1 across bank-accounts actions, the transaction form, and dashboard queries.

## Capabilities and Constraints

Capabilities: create/update/delete bank accounts and transactions; categorize transactions; multi-currency tracking with conversion to default currency; dashboard aggregate charts; soft-delete columns (deletedAt) exist on tables but soft-delete filtering is not implemented everywhere. Constraints: userId is hardcoded to 1 (no session-derived auth); soft-delete filtering is not honored in all queries; validation uses Zod schemas per feature; form state uses useActionState with sonner toasts.

## Brand Commitments

None established.

## Evidence on Hand

- package.json (app name "finance-tracking", Next.js 16.1.7, React 19, Tailwind CSS 4, shadcn/ui, Drizzle ORM, MySQL, Recharts, Sonner, pdfjs-dist, xlsx)
- db/schema/schema.ts (users, bankAccounts, transactions, categories, currencies tables)
- AGENTS.md (four-layer feature structure: app/<feature>/ routes + _components + schema, server/<feature>/ actions.ts + queries.ts, types/<feature>.types.ts)

## Product Principles

- Individual-first: every screen and flow serves one person managing personal finances, not households or businesses.
- Performance and responsiveness: a high-performance, mobile-responsive web app per the package.json description.
- Data integrity: monetary amounts tracked as decimals with currency, exchange rate, and default-currency conversion.
- Transparent defaults: default currency HNL is a configurable schema default, not a hidden assumption.

## Accessibility & Inclusion

No product-specific accessibility requirement established yet.
