# 📋 Plan de Tests — Financial Control (Unit + Integración)

> **Estado:** Listo para implementar. No se incluyen tests E2E (Playwright) — quedan para una sesión posterior.
>
> **Stack:** Vitest v4.1.11 + MySQL de test (`.env.test.local`) + Drizzle ORM + Next.js 16 App Router.
>
> **URL de Notion:** https://app.notion.com/p/Finance-Tracking-35911a749f8e8003b493f0020e1011cf

---

## 1. Resumen del estado actual

### ✅ Ya está testeado

| Archivo | Tipo | Qué cubre |
|---------|------|-----------|
| `tests/unit/session.spec.ts` | Unit | `isDbUnavailableError` (códigos/errores de DB caída) y `getSessionUserInfo` (no-token, bad-token, authenticated, user-not-found, db-unavailable) |
| `tests/integration/transactions.spec.ts` | Integration | `createTransaction`: éxito, monto inválido (no persiste), userId spoofeado (ignorado) |
| `tests/integration/db.spec.ts` | Integration | Inserción y lectura de usuario (smoke de DB) |
| `tests/e2e/transactions.test.ts` | E2E | Crear transacción vía UI y que aparezca en el listado |
| `tests/e2e/maintenance.spec.ts` | E2E | DB caída → `/unavailable`, reintento, logout limpia cookie |

### ❌ FALTA POR TESTEAR (unit + integration)

Prácticamente todo el resto: **users, bank-accounts, categories, transactions (update/delete/bulk/queries), dashboard (5 queries), libs (currency, utils, parsers, jwt) y componentes UI (project "ui" ya configurado en vitest pero sin un solo test)**.

---

## 2. Stack y configuración de testing

- **Runner:** Vitest v4.1.11
- **Proyectos Vitest** (`vitest.config.mts`):
  - `server` (entorno `node`): `server/**/*.test.ts`, `tests/integration/**/*.spec.ts`, `tests/unit/**/*.spec.ts`, setup `tests/setup/db.ts`
  - `ui` (entorno `jsdom`): `app/**/*.test.tsx`, setup `tests/setup/vitest.setup.ts` *(este archivo de setup aún no existe)*
- **Base de tests:** MySQL de test (`.env.test.local` → `test_finance_db`), `truncateDatabase()` limpia tablas en orden FK (`transactions`, `bank_accounts`, `categories`, `users`)
- **Patrón de acciones (Server Actions):** `parse FormData → schema.safeParse → z.treeifyError → db.insert/update/delete → revalidatePath → { success, message, fields }`
- **Patrón de queries:** try/catch → `{ ok: true, data }` o `{ ok: false, error: { code, message } }` (`types/result.ts`)
- **Auth:** sin auth real, `userId` viene de sesión JWT (`lib/jwt.ts`), hardcodeado a `1` en varios sitios pendiente de migrar a sesión real

---

## 3. Convenciones (según AGENTS.md)

- Los Server Actions reciben `(prevState, formData)` y devuelven el estado tipado.
- Las queries devuelven `Result<T>` (`ok`/`err`), nunca lanzan al caller.
- `userId` se obtiene con `getSessionUserId()` de `@/lib/jwt`; en tests se mockea `@/lib/jwt.ts` o `@/lib/jwt`.
- `next/cache` (`revalidatePath`) se mockea en tests de acciones.
- Se usa `vi.hoisted` para la sesión mutable entre tests (`session.userId`).

---

## 4. Plan de tests por feature

### 4.1 Session / Auth / JWT (Unit)

**Archivo propuesto:** `tests/unit/session.spec.ts` (ampliar el existente)

Ya cubre: `isDbUnavailableError` y `getSessionUserInfo`. Falta:

| ID | Función | Caso | Dado | Cuando | Entonces |
|----|---------|------|------|--------|----------|
| S-01 | `getSessionUserId` | retorna userId válido | cookie de sesión válida | se llama `getSessionUserId()` | devuelve `number` |
| S-02 | `getSessionUserId` | retorna null sin cookie | no hay cookie | se llama `getSessionUserId()` | devuelve `null` |
| S-03 | `getSessionUserId` | retorna null con token inválido | cookie con token malformado | se llama `getSessionUserId()` | devuelve `null` |
| S-04 | `requireUserId` | lanza error sin sesión | no hay cookie | se llama `requireUserId()` | lanza `Error("Unauthorized...")` |
| S-05 | `verifySessionToken` | valida token correcto | token JWT válido | `verifySessionToken(token)` | devuelve `{ userId: number }` |
| S-06 | `verifySessionToken` | rechaza token inválido | token corrupto | `verifySessionToken("basura")` | devuelve `null` |
| S-07 | `hasSessionCookie` | true si existe cookie | cookie presente | `hasSessionCookie()` | `true` |
| S-08 | `hasSessionCookie` | false si no existe | sin cookie | `hasSessionCookie()` | `false` |

**Mocks:** `@/lib/jwt` (cookies de next/headers), `jose` (`jwtVerify`, `SignJWT`).

---

### 4.2 Users (Unit + Integración)

**Archivos propuestos:** `tests/integration/users.spec.ts`, `tests/unit/users.spec.ts`

| ID | Tipo | Función | Caso | Dado | Cuando | Entonces |
|----|------|---------|------|------|--------|----------|
| U-01 | integration | `createUser` | registro exitoso | datos válidos (name, email, password ≥8, confirm igual) | llamar acción | `success: true`, usuario insertado, password hasheado |
| U-02 | integration | `createUser` | email duplicado | email ya existe | llamar acción | `success: false`, error `email: "This email is already registered"` |
| U-03 | integration | `createUser` | contraseñas no coinciden | password ≠ confirmPassword | llamar acción | `success: false`, error en confirmPassword |
| U-04 | integration | `createUser` | password corta (<8) | password de 5 chars | llamar acción | `success: false`, error en password |
| U-05 | unit | `createUser` | hash de password | bcrypt | verificar llamada | `bcrypt.hash` llamado con salt 10 |
| U-06 | integration | `loginUser` | credenciales válidas | usuario existe, password correcto | llamar acción | `success: true`, `setSessionCookie` llamado, revalidatePath("/dashboard") |
| U-07 | integration | `loginUser` | email inexistente | email no registrado | llamar acción | `success: false`, "Invalid email or password" |
| U-08 | integration | `loginUser` | password incorrecto | usuario existe, password mal | llamar acción | `success: false`, "Invalid email or password" |
| U-09 | integration | `loginUser` | datos inválidos | email vacío | llamar acción | `success: false`, errores de validación por campo |
| U-10 | integration | `loginAsDemo` | establece sesión demo | — | llamar acción | cookie userId=1, redirect("/dashboard") |
| U-11 | integration | `logout` | limpia sesión | sesión activa | llamar acción | `clearSessionCookie`, redirect("/") |
| U-12 | unit | `getSessionStatus` | devuelve estado | `getSessionUserInfo` mockeado | llamar `getSessionStatus()` | retorna status correcto |
| U-13 | integration | `updateDefaultCurrency` | moneda válida | usuario autenticado, moneda HNL/USD/EUR | llamar acción | `success: true`, usuario actualizado, revalidatePaths |
| U-14 | integration | `updateDefaultCurrency` | moneda inválida | moneda "XXX" | llamar acción | `success: false`, error `currency` |
| U-15 | integration | `updateDefaultCurrency` | sin sesión | no autenticado | llamar acción | `success: false`, "Unauthorized" |
| U-16 | integration | `getUserById` | usuario encontrado | id existe | llamar query | `ok: true`, data con id/name/email/defaultCurrency |
| U-17 | integration | `getUserById` | usuario no encontrado | id inexistente | llamar query | `ok: false`, code "not_found" |
| U-18 | unit | `getUserById` | DB caída | error ECONNREFUSED | llamar query | `ok: false`, `dbUnavailable: true` |
| U-19 | unit | `isDbUnavailableError` | causa anidada | error con cause chain | llamar función | detecta DB unavailable en causa profunda |
| U-20 | unit | `matchesDbUnavailable` | códigos errno | errno -4078/-4037 | llamar función | `true` |

**Mocks:** `bcryptjs` (hash/compare), `@/lib/jwt` (set/clear cookie), `next/cache`, `next/navigation` (redirect).

---

### 4.3 Bank Accounts (Unit + Integración)

**Archivo propuesto:** `tests/integration/bank-accounts.spec.ts`

| ID | Tipo | Función | Caso | Dado | Cuando | Entonces |
|----|------|---------|------|------|--------|----------|
| BA-01 | integration | `createBankAccount` | éxito | datos válidos, cuenta nueva, usuario autenticado | llamar acción | `success: true`, cuenta insertada con userId correcto, revalidatePath("/bank-accounts") |
| BA-02 | integration | `createBankAccount` | duplicado accountNumber | cuenta con mismo número existe | llamar acción | `success: false`, error `accountNumber` |
| BA-03 | integration | `createBankAccount` | duplicado accountName | cuenta con mismo nombre existe | llamar acción | `success: false`, error `accountName` |
| BA-04 | integration | `createBankAccount` | sin sesión | `getSessionUserId` → null | llamar acción | `success: false`, "Unauthorized" |
| BA-05 | integration | `createBankAccount` | campos inválidos | accountNumber con letras | llamar acción | `success: false`, errores de zod por campo |
| BA-06 | integration | `createBankAccount` | error DB | inserción falla | llamar acción | `success: false`, mensaje de error |
| BA-07 | integration | `updateBankAccount` | éxito | id válido, datos nuevos, pertenece al usuario | llamar acción | `success: true`, cuenta actualizada |
| BA-08 | integration | `updateBankAccount` | id faltante/inválido | no se envía id | llamar acción | `success: false`, "Missing or invalid Bank Account ID" |
| BA-09 | integration | `updateBankAccount` | no autenticado | sesión nula | llamar acción | `success: false`, "Unauthorized" |
| BA-10 | integration | `updateBankAccount` | cuenta no existe | id inexistente | llamar acción | `success: false` (0 filas afectadas) |
| BA-11 | integration | `deleteBankAccount` | éxito | id válido, pertenece al usuario | llamar acción | `success: true`, cuenta eliminada |
| BA-12 | integration | `deleteBankAccount` | sin sesión | sesión nula | llamar acción | `success: false`, "Unauthorized" |
| BA-13 | unit | `checkDuplicateAccount` | duplicado por número | misma accountNumber, distinto id | llamar función | `isDuplicate: true`, error accountNumber |
| BA-14 | unit | `checkDuplicateAccount` | duplicado por nombre | misma accountName | llamar función | `isDuplicate: true`, error accountName |
| BA-15 | unit | `checkDuplicateAccount` | no duplicado | datos únicos | llamar función | `isDuplicate: false` |
| BA-16 | unit | `checkDuplicateAccount` | excluir自身 en update | mismo número pero es la propia cuenta (id) | llamar función con id | `isDuplicate: false` |
| BA-17 | integration | `getBankAccounts` | éxito | cuentas del usuario | llamar query | `ok: true`, lista de cuentas |
| BA-18 | integration | `getBankAccounts` | sin sesión | sesión nula | llamar query | `ok: false`, code "unauthorized" |
| BA-19 | integration | `getBankAccounts` | DB caída | error de conexión | llamar query | `ok: false`, code "database" |
| BA-20 | integration | `getBankAccountsPaginated` | paginación | page=1, pageSize=5 | llamar query | devuelve 5 items, `hasMore` correcto |
| BA-21 | integration | `getBankAccountsPaginated` | hasMore | más de pageSize registros | llamar query | `hasMore: true` |
| BA-22 | integration | `getBankAccountById` | encontrado | id válido del usuario | llamar query | `ok: true`, cuenta |
| BA-23 | integration | `getBankAccountById` | no encontrado | id inexistente | llamar query | `ok: false`, code "not_found" |
| BA-24 | integration | `getBankAccountById` | no pertenece al usuario | id de otro usuario | llamar query | `ok: false`, code "not_found" |

**Mocks:** `@/lib/jwt`, `next/cache`.

---

### 4.4 Categories (Unit + Integración)

**Archivo propuesto:** `tests/integration/categories.spec.ts`

| ID | Tipo | Función | Caso | Dado | Cuando | Entonces |
|----|------|---------|------|------|--------|----------|
| C-01 | integration | `createCategory` | éxito | name, icon, color válidos, usuario autenticado | llamar acción | `success: true`, categoría insertada con userId |
| C-02 | integration | `createCategory` | sin sesión | `getSessionUserId` → null | llamar acción | `success: false`, "Unauthorized" |
| C-03 | integration | `createCategory` | nombre vacío | name "" | llamar acción | `success: false`, error `name` |
| C-04 | integration | `createCategory` | icon inválido | icon no está en CATEGORY_ICON_KEYS | llamar acción | `success: false`, error `icon` |
| C-05 | integration | `createCategory` | color no hex | color "rojo" | llamar acción | `success: false`, error `color` |
| C-06 | integration | `updateCategory` | éxito | id válido, datos nuevos | llamar acción | `success: true`, categoría actualizada |
| C-07 | integration | `updateCategory` | id faltante | no se envía id | llamar acción | `success: false`, "Missing or invalid category ID" |
| C-08 | integration | `updateCategory` | sin sesión | sesión nula | llamar acción | `success: false`, "Unauthorized" |
| C-09 | integration | `deleteCategory` | éxito | categoría no por defecto, del usuario | llamar acción | `success: true`, eliminada, transacciones reasignadas a default |
| C-10 | integration | `deleteCategory` | es categoría por defecto | id === defaultCategoryId | llamar acción | `success: false`, "The default category can't be deleted" |
| C-11 | integration | `deleteCategory` | no encontrada | id inexistente | llamar acción | `success: false`, "Category not found" |
| C-12 | integration | `deleteCategory` | no pertenece al usuario | categoría de otro usuario | llamar acción | `success: false`, "You can only delete your own categories" |
| C-13 | integration | `deleteCategory` | reasigna transacciones | transacciones con categoría borrada | llamar acción | esas transacciones apuntan ahora a defaultCategoryId |
| C-14 | integration | `getCategories` | éxito | categorías del usuario + globales (userId null) | llamar query | `ok: true`, incluye ambas |
| C-15 | integration | `getCategories` | sin sesión | sesión nula | llamar query | `ok: false`, "unauthorized" |
| C-16 | integration | `getCategoryById` | encontrado | id válido | llamar query | `ok: true` |
| C-17 | integration | `getCategoryById` | no encontrado | id inexistente | llamar query | `ok: false`, code "not_found" |
| C-18 | unit | `getDefaultCategory` | categoría del usuario | existe "Miscellaneous / Others" con userId | llamar query | `ok: true`, devuelve categoryId del usuario |
| C-19 | unit | `getDefaultCategory` | fallback global | no hay del usuario, sí global (userId null) | llamar query | `ok: true`, devuelve categoryId global |
| C-20 | unit | `getDefaultCategory` | no existe ninguna | no hay categoría por defecto | llamar query | `ok: false`, code "not_found" |

**Mocks:** `@/lib/jwt`, `next/cache`, `DEFAULT_CATEGORY_NAME`.

---

### 4.5 Transactions (Unit + Integración) — completar lo parcial

**Archivo propuesto:** `tests/integration/transactions.spec.ts` (ya existe, ampliar)

Ya cubre: `createTransaction` éxito, monto inválido, userId spoofing. Falta:

| ID | Tipo | Función | Caso | Dado | Cuando | Entonces |
|----|------|---------|------|------|--------|----------|
| T-01 | integration | `createTransaction` | sin sesión | `getSessionUserId` → null | llamar acción | `success: false`, "Unauthorized" |
| T-02 | integration | `createTransaction` | moneda distinta a default | transactionCurrency USD, default HNL | llamar acción | `success: true`, `exchangeRate` y `amountInDefaultCurrency` convertidos |
| T-03 | integration | `createTransaction` | fallo de tasa de cambio | `getExchangeRate` lanza error | llamar acción | `success: false`, mensaje de error, no persiste |
| T-04 | integration | `createTransaction` | categoría por defecto | categoryId vacío, hay default category | llamar acción | se resuelve a `getDefaultCategory` |
| T-05 | integration | `createTransaction` | cuenta no pertenece al usuario | accountId de otro usuario | llamar acción | `success: false` o validación falla |
| T-06 | integration | `createTransaction` | fecha futura | transactionDate > hoy | llamar acción | `success: false`, error `transactionDate` |
| T-07 | integration | `createTransaction` | campos inválidos | amount "abc", falta accountId | llamar acción | `success: false`, errores zod por campo |
| T-08 | integration | `updateTransaction` | éxito | id válido, datos nuevos, del usuario | llamar acción | `success: true`, transacción actualizada |
| T-09 | integration | `updateTransaction` | id faltante/inválido | sin id | llamar acción | `success: false`, "Missing or invalid transaction ID" |
| T-10 | integration | `updateTransaction` | sin sesión | sesión nula | llamar acción | `success: false`, "Unauthorized" |
| T-11 | integration | `updateTransaction` | moneda conversión | cambia transactionCurrency | llamar acción | `amountInDefaultCurrency` recalculado |
| T-12 | integration | `deleteTransaction` | éxito | id válido, del usuario | llamar acción | `success: true`, transacción eliminada |
| T-13 | integration | `deleteTransaction` | sin sesión | sesión nula | llamar acción | `success: false`, "Unauthorized" |
| T-14 | integration | `deleteTransaction` | de otro usuario | id de otro usuario | llamar acción | no se elimina (0 filas) |
| T-15 | integration | `createBulkTransactions` | éxito | JSON válido, cuenta válida, filas válidas | llamar acción | `success: true`, saved = N, filas insertadas |
| T-16 | integration | `createBulkTransactions` | sin sesión | sesión nula | llamar acción | `success: false`, "Unauthorized" |
| T-17 | integration | `createBulkTransactions` | cuenta inválida | accountId no numérico o inexistente | llamar acción | `success: false`, "Invalid bank account" |
| T-18 | integration | `createBulkTransactions` | JSON inválido | transactionsJson no es JSON | llamar acción | `success: false`, "Invalid transactions payload" |
| T-19 | integration | `createBulkTransactions` | filas inválidas | fila sin amount o date inválida | llamar acción | filas marcadas failed, saved = 0 para esas |
| T-20 | integration | `createBulkTransactions` | moneda del lote | transactionCurrency USD | llamar acción | tasa resuelta una vez, aplicada a todas |
| T-21 | integration | `createBulkTransactions` | categoría por defecto | filas sin categoryId | llamar acción | se asigna defaultCategoryId |
| T-22 | integration | `createBulkTransactions` | chunking | >100 filas válidas | llamar acción | inserts en chunks de 100, savedTempIds devueltos |
| T-23 | integration | `getTransactions` | éxito | transacciones del usuario | llamar query | `ok: true`, listado con accountName/bankName/categoryName |
| T-24 | integration | `getTransactions` | sin sesión | sesión nula | llamar query | `ok: false`, "unauthorized" |
| T-25 | integration | `getTransactionsPaginated` | paginación | page, pageSize | llamar query | items + hasMore correctos |
| T-26 | integration | `getTransactionsById` | encontrado | id válido del usuario | llamar query | `ok: true`, detalle completo |
| T-27 | integration | `getTransactionsById` | no encontrado | id inexistente | llamar query | `ok: false`, "not_found" |
| T-28 | integration | `getTransactionsById` | de otro usuario | id de otro usuario | llamar query | `ok: false`, "not_found" |

**Mocks:** `@/lib/jwt`, `next/cache`, `@/lib/currency` (getExchangeRate), `@/server/categories/queries` (getDefaultCategory), `@/server/bank-accounts/queries` (getBankAccountById).

---

### 4.6 Dashboard (Integración)

**Archivo propuesto:** `tests/integration/dashboard.spec.ts`

Nada está testeado aún. Todas las 5 queries usan `convertAmount` con `getExchangeRates` (Fetch a API externa) — mockear `lib/currency`.

| ID | Tipo | Función | Caso | Dado | Cuando | Entonces |
|----|------|---------|------|------|--------|----------|
| D-01 | integration | `getMonthlyFinancials` | 6 meses ingresos/gastos | transacciones en distintos meses | llamar query | array de 6 meses, income/expense acumulados por mes |
| D-02 | integration | `getMonthlyFinancials` | conversión de moneda | transacciones en USD, default HNL | llamar query | montos convertidos a HNL |
| D-03 | integration | `getMonthlyFinancials` | sin transacciones | usuario sin datos | llamar query | `ok: true`, array vacío |
| D-04 | integration | `getDailyAverage` | promedio del mes | gastos del mes actual | llamar query | monthTotal, dailyAverage, currentDay |
| D-05 | integration | `getDailyAverage` | sin gastos | sin transacciones expense este mes | llamar query | total 0, dailyAverage 0 |
| D-06 | integration | `getNetBalance` | saldo inicial + transacciones | cuentas con openingBalance + txs | llamar query | número neto (opening + income − expense) |
| D-07 | integration | `getNetBalance` | conversión de moneda | cuentas en USD/EUR | llamar query | balances convertidos a defaultCurrency |
| D-08 | integration | `getNetBalance` | sin cuentas | usuario sin bankAccounts | llamar query | `ok: true`, 0 |
| D-09 | integration | `getFundsDistribution` | distribución por cuenta | varias cuentas con balances | llamar query | array FundShare por cuenta, value ≥ 0 |
| D-10 | integration | `getFundsDistribution` | balance negativo → 0 | cuenta con balance negativo | llamar query | `value: 0` para esa cuenta |
| D-11 | integration | `getFundsDistribution` | sin cuentas | sin bankAccounts | llamar query | `ok: true`, array vacío |
| D-12 | integration | `getExpensesByCategories` | gastos por categoría del año | expenses del año actual | llamar query | array con categoryName, total_amount, color, icon |
| D-13 | integration | `getExpensesByCategories` | categorías globales | categorías con userId null incluidas | llamar query | se incluyen en el join |
| D-14 | integration | `getExpensesByCategories` | sin gastos | sin expenses este año | llamar query | `ok: true`, array vacío |

**Mocks:** `@/lib/currency` (getExchangeRates → devolver tasas fijas), `@/lib/jwt`.

---

### 4.7 Libs (Unit)

**Archivos propuestos:** `tests/unit/currency.spec.ts`, `tests/unit/utils.spec.ts`, `tests/unit/parsers.spec.ts`

#### 4.7.1 `lib/currency.ts`

| ID | Función | Caso | Dado | Cuando | Entonces |
|----|---------|------|------|--------|----------|
| L-01 | `getExchangeRate` | misma moneda | from === to | llamar | retorna 1 sin fetch |
| L-02 | `getExchangeRate` | tasa cacheada válida | caché no expirado | llamar | retorna del caché, sin fetch |
| L-03 | `getExchangeRate` | fetch exitoso | mock fetch devuelve rates | llamar | retorna rate correcto y llena caché |
| L-04 | `getExchangeRate` | API error | fetch responde !ok | lanzar | lanza Error con status |
| L-05 | `getExchangeRate` | moneda no encontrada | rate undefined | lanzar | lanza Error "No rate found" |
| L-06 | `getExchangeRates` | múltiples monedas | tos = [USD, EUR] | llamar | devuelve object con todas las tasas |
| L-07 | `getExchangeRates` | caché parcial | algunas en caché, otras no | llamar | fetch solo para pendientes |

**Mocks:** `fetch` global (mock de Response con JSON).

#### 4.7.2 `lib/utils.ts`

| ID | Función | Caso | Dado | Cuando | Entonces |
|----|---------|------|------|--------|----------|
| L-08 | `formatCurrency` | número | 1234.5, HNL | llamar | "L. 1,234.50" |
| L-09 | `formatCurrency` | string numérico | "100", USD | llamar | "$ 100.00" |
| L-10 | `formatCurrency` | NaN | "abc" | llamar | "0.00" |
| L-11 | `formatCompactCurrency` | compacto | 15000, HNL | llamar | notación compacta |
| L-12 | `CURRENCY_OPTIONS` | lista | — | verificar | contiene HNL, USD, EUR |

#### 4.7.3 Parsers (`lib/parsers/`)

| ID | Función | Caso | Dado | Cuando | Entonces |
|----|---------|------|------|--------|----------|
| L-13 | `getFileSource` | CSV | "estado.csv" | llamar | "csv" |
| L-14 | `getFileSource` | Excel | "movs.xlsx" | llamar | "excel" |
| L-15 | `getFileSource` | PDF | "estado.pdf" | llamar | "pdf" |
| L-16 | `getFileSource` | desconocido | "foto.jpg" | llamar | "unknown" |
| L-17 | `parseCsv` | CSV válido | contenido con headers fecha/descripción/monto | llamar | transactions parseadas, errors [] |
| L-18 | `parseCsv` | fecha inválida | fila con fecha basura | llamar | error en esa fila, transacción omitida |
| L-19 | `parseCsv` | columnas débito/crédito | sin columna amount | llamar | tipo income/expense por débito/crédito |
| L-20 | `parseCsv` | error de lectura | Papa.parse error | llamar | transactions [], error "Could not read the CSV file" |
| L-21 | `parseExcel` | Excel válido | buffer con hoja de datos | llamar | transactions parseadas |
| L-22 | `parseExcel` | serial de Excel | fecha como número 45930 | llamar | convertida a YYYY-MM-DD |
| L-23 | `parseExcel` | sin cabecera | no hay fila con fecha | llamar | error "No se encontró la fila de cabecera" |
| L-24 | `parseAtlántidaPDF` | formato 1 | texto DD/MM/YYYY con L montos | llamar | transactions tipo Formato 1 |
| L-25 | `parseAtlántidaPDF` | formato 2 | texto YYYY-Mes-DD | llamar | transactions tipo Formato 2 |
| L-26 | `parseAtlántidaPDF` | sin movimientos | texto sin patrón | llamar | transactions [], error "No valid movements detected" |
| L-27 | `extractTransactions` | archivo desconocido | "foto.png" | llamar | transactions [], error de formato incompatible |
| L-28 | `cleanAmount` | formato europeo | "1.234,56" | llamar | "1234.56" |
| L-29 | `cleanAmount` | con símbolo L | "L 3,300.00" | llamar | "3300.00" |
| L-30 | `normalizeDate` | DD/MM/YYYY | "07/09/2026" | llamar | "2026-09-07" |
| L-31 | `normalizeDate` | YYYY-Mes-DD | "2026-Sep-07" | llamar | "2026-09-07" |

**Mocks:** `fetch`, `Papa.parse`, `XLSX.read`, `pdfjs-dist` (solo para integración de PDF, opcional en unit).

---

### 4.8 Componentes UI (Project "ui" — jsdom)

**Archivos propuestos:** `app/(app)/.../*.test.tsx` (uno por componente/formulario)

El vitest config ya tiene el project `ui` con `include: ["app/**/*.test.tsx"]` y setup `tests/setup/vitest.setup.ts` (pendiente de crear). No hay ni un test de componentes aún.

| ID | Componente | Qué testear |
|----|-----------|-------------|
| UI-01 | `FormBankAccounts` | render create/edit, submit válido → success toast + router.push, submit inválido → FieldError por campo, deshabilita submit mientras isPending |
| UI-02 | `FormCategory` | crear/editar categoría, validaciones (nombre, icon, color hex), toast + redirect |
| UI-03 | `FormTransaction` | crear transacción, select cuenta/tipo/moneda/fecha/categoría, validación monto, deshabilitado sin cuentas, redirect al éxito |
| UI-04 | `FormSettings` | cambiar moneda default, validación HNL/USD/EUR, toast |
| UI-05 | `UploadBulkTransactionForm` | select cuenta, dropzone, tabla previa editable, guardar → createBulkTransactions, limpiar filas guardadas (savedTempIds) |
| UI-06 | `LoginForm` | login exitoso → redirect /dashboard, login fallido → toast error, "Try demo" → loginAsDemo |
| UI-07 | `SignupForm` | registro exitoso → redirect /, errores de validación (email, password, confirm), passwords no coinciden |
| UI-08 | `ExpensesByCategoryChart` | render barras, categoría con más gasto, formato moneda en tooltip, versión móvil |
| UI-09 | `IncomesExpensesChart` | render áreas income/expense, leyenda con click para ocultar serie, total positivo/negativo |
| UI-10 | `ChartPieSimple` | render torta, fondos por account, tooltip con moneda |
| UI-11 | `TableBankAccounts` / `CardBanksAccount` | render listado, paginación, vista móvil vs desktop |
| UI-12 | `TransactionsTable` / `TransactionsCard` | render transacciones, formato moneda, tipo ingreso/gasto |
| UI-13 | `TableCategories` / `CardCategories` | render categorías |
| UI-14 | `pagination` | controles de página, hasMore |
| UI-15 | `ActionsBankAccountTable` / `ActionsCategoryTable` / `TransactionsActions` | botones editar/eliminar, confirmación |

**Mocks:** Server Actions mockeados (`vi.mock` de `@/server/.../actions`), `next/navigation` router, `sonner` toast, `cookies()`.

---

## 5. Archivos propuestos y ubicación

```
tests/
├── unit/
│   ├── session.spec.ts          (ampliar: JWT, getSessionUserId, requireUserId, verifySessionToken)
│   ├── users.spec.ts            (isDbUnavailableError causa profunda, matchesDbUnavailable)
│   ├── currency.spec.ts         (getExchangeRate, getExchangeRates, caché)
│   ├── utils.spec.ts            (formatCurrency, formatCompactCurrency)
│   └── parsers.spec.ts          (getFileSource, parseCsv, parseExcel, parseAtlántidaPDF, cleanAmount, normalizeDate, extractTransactions)
├── integration/
│   ├── users.spec.ts            (createUser, loginUser, loginAsDemo, logout, updateDefaultCurrency, getUserById, getUserDefaultCurrency)
│   ├── bank-accounts.spec.ts    (create/update/delete, checkDuplicateAccount, getBankAccounts/Paginated/ById)
│   ├── categories.spec.ts       (create/update/delete, getCategories/ById, getDefaultCategory)
│   ├── transactions.spec.ts     (ampliar: update/delete/bulk/queries + los pendientes de create)
│   └── dashboard.spec.ts        (getMonthlyFinancials, getDailyAverage, getNetBalance, getFundsDistribution, getExpensesByCategories)
├── e2e/                         (Playwright — sesión posterior)
│   ├── transactions.test.ts     (existente)
│   └── maintenance.spec.ts      (existente)
└── setup/
    ├── db.ts                    (existente: truncateDatabase)
    └── vitest.setup.ts          (CREAR: testing-library, matchers jest-dom para project ui)
```

---

## 6. Prerrequisitos y entorno

1. `DATABASE_URL` apuntando a la base de test (`test_finance_db` en `.env.test.local`).
2. `JWT_SECRET` definido en `.env.test.local`.
3. Ejecutar `npm run db:push` o `npm run db:migrate` contra la base de test antes de los tests de integración.
4. Crear `tests/setup/vitest.setup.ts` para el project `ui` (importar `@testing-library/jest-dom`, configurar matchers).
5. Para tests de currency: mock de `fetch` (no llamar a la API externa Frankfurter/open.er-api).
6. Ejecutar: `npm test` (vitest) — los e2e van aparte con `npm run test:e2e`.

---

## 7. Criterios de aceptación por test (todos deben cumplir)

- **Integración:** usar DB real de test, `truncateDatabase()` en `beforeEach`, verificar persistencia en tablas (no solo el retorno de la acción).
- **Unit:** no tocar DB, mockear I/O (fetch, cookies, next/cache, bcrypt).
- **Seguridad:** verificar que `userId` nunca se tome del cliente (FormData) — siempre de sesión (caso de spoofing ya cubierto en createTransaction, replicar en update/delete/bulk).
- **Validación:** cada campo inválido debe producir `error.<campo>` definido y `success: false` sin persistir.
- **Manejo de errores:** DB caída → `dbUnavailable: true` / code "database"; no encontrado → code "not_found"; no autorizado → code "unauthorized".

---

## 8. Próximo paso: tests E2E (2e2) — sesión posterior

Quedan pendientes para una sesión dedicada con Playwright:
- Flujo completo de alta de usuario (signup → login → dashboard).
- CRUD de bank accounts, categories y transactions vía UI.
- Bulk upload de archivo (CSV/Excel/PDF) y ver que las transacciones aparecen.
- Cambio de moneda default y ver actualización en dashboard y gráficos.
- Navegación móvil vs desktop (tabla vs tarjetas).
- Escenario de base de datos caída (ya parcialmente en `maintenance.spec.ts`).

---

> Este documento está listo para ser copiado y pegado en la página de Notion: https://app.notion.com/p/Finance-Tracking-35911a749f8e8003b493f0020e1011cf