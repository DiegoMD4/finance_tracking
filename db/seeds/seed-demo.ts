import { drizzle } from "drizzle-orm/mysql2"
import { eq, sql } from "drizzle-orm"
import mysql from "mysql2/promise"
import { bankAccounts, transactions, categories } from "../schema/schema"
import "dotenv/config"

const connection = await mysql.createConnection({
  uri: process.env.DATABASE_URL,
})

const db = drizzle(connection)

const DEMO_ACCOUNTS = [
  {
    accountNumber: "1234567890",
    bankName: "BAC Credomatic",
    accountName: "Cuenta Corriente",
    bankAccountType: "checking",
    accountEmail: "demo@bac.com",
    accountCurrency: "Dollars",
    openingBalance: "5000.00",
  },
  {
    accountNumber: "0987654321",
    bankName: "Banco Atlántida",
    accountName: "Ahorros Personal",
    bankAccountType: "savings",
    accountEmail: "demo@atlantida.com",
    accountCurrency: "Lempiras",
    openingBalance: "25000.00",
  },
  {
    accountNumber: "5555666677",
    bankName: "Banco Ficohsa",
    accountName: "Tarjeta Nómina",
    bankAccountType: "payroll",
    accountEmail: "demo@ficohsa.com",
    accountCurrency: "Lempiras",
    openingBalance: "8500.00",
  },
]

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function getRandomDate(monthsAgo: number): Date {
  const now = new Date()
  const pastDate = new Date()
  pastDate.setMonth(now.getMonth() - monthsAgo)
  pastDate.setDate(randomBetween(1, 28))
  pastDate.setHours(randomBetween(6, 22), randomBetween(0, 59), 0, 0)
  return pastDate
}

interface TransactionTemplate {
  categoryName: string
  type: "income" | "expense"
  amountRange: [number, number]
  descriptions: string[]
}

const INCOME_TRANSACTIONS: TransactionTemplate[] = [
  {
    categoryName: "Salary & Income",
    type: "income",
    amountRange: [1500, 4000],
    descriptions: ["Salario quincenal", "Depósito de nómina", "Transferencia recibida"],
  },
  {
    categoryName: "Investments & Savings",
    type: "income",
    amountRange: [100, 500],
    descriptions: ["Rendimiento inversión", "Dividendos", "Intereses ganados"],
  },
]

const EXPENSE_TRANSACTIONS: TransactionTemplate[] = [
  {
    categoryName: "Housing & Utilities",
    type: "expense",
    amountRange: [2000, 4500],
    descriptions: ["Pago de alquiler", "Servicios públicos", "Agua y luz"],
  },
  {
    categoryName: "Food & Dining",
    type: "expense",
    amountRange: [150, 600],
    descriptions: ["Supermercado", "Restaurante", "Comida delivery", "Café"],
  },
  {
    categoryName: "Transportation",
    type: "expense",
    amountRange: [50, 300],
    descriptions: ["Gasolina", "Uber", "Passaje bus", "Estacionamiento"],
  },
  {
    categoryName: "Shopping & Entertainment",
    type: "expense",
    amountRange: [100, 800],
    descriptions: ["Compra online", "Ropa", "Netflix", "Suscripción"],
  },
  {
    categoryName: "Health & Medical",
    type: "expense",
    amountRange: [50, 400],
    descriptions: ["Farmacia", "Consulta médica", "Exámenes"],
  },
  {
    categoryName: "Education",
    type: "expense",
    amountRange: [200, 1500],
    descriptions: ["Curso online", "Libros", "Materiales"],
  },
  {
    categoryName: "Miscellaneous / Others",
    type: "expense",
    amountRange: [20, 150],
    descriptions: ["Varios", "Regalo", "Propina", "Misceláneos"],
  },
]

async function getCategoryMap(): Promise<Map<string, number>> {
  const cats = await db.select().from(categories)
  const categoryMap = new Map<string, number>()

  for (const cat of cats) {
    if (cat.name) {
      categoryMap.set(cat.name, cat.categoryId)
    }
  }

  return categoryMap
}

async function seedDemoAccounts(userId: number): Promise<number[]> {
  const accountIds: number[] = []

  console.log("🏦 Creando cuentas bancarias de prueba...")

  for (const account of DEMO_ACCOUNTS) {
    const existing = await db
      .select({ id: bankAccounts.id })
      .from(bankAccounts)
      .where(eq(bankAccounts.accountNumber, account.accountNumber))
      .then((rows) => rows[0])

    if (existing) {
      accountIds.push(existing.id)
      console.log(`  ⏭️  ${account.bankName} - ${account.accountName} (ya existe, ID: ${existing.id})`)
      continue
    }

    const [result] = await db.insert(bankAccounts).values({
      ...account,
      userId,
    })

    const insertId = Number(result.insertId)
    accountIds.push(insertId)
    console.log(`  ✅ ${account.bankName} - ${account.accountName} (ID: ${insertId})`)
  }

  return accountIds
}

async function seedTransactions(
  userId: number,
  accountIds: number[],
  categoryMap: Map<string, number>
): Promise<void> {
  console.log("💰 Generando transacciones de prueba (6 meses)...")

  const [{ count }] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(transactions)
    .where(eq(transactions.userId, userId))

  if (Number(count) > 0) {
    console.log(`  ⏭️  Ya existen ${count} transacciones para este usuario, se omite.`)
    return
  }

  let totalTransactions = 0

  for (let monthsAgo = 5; monthsAgo >= 0; monthsAgo--) {
    const transactionsPerMonth = randomBetween(12, 20)

    for (let i = 0; i < transactionsPerMonth; i++) {
      const isIncome = Math.random() < 0.25
      const templates = isIncome ? INCOME_TRANSACTIONS : EXPENSE_TRANSACTIONS
      const template = templates[randomBetween(0, templates.length - 1)]

      const categoryId = categoryMap.get(template.categoryName)
      if (!categoryId) {
        console.warn(`  ⚠️  Categoría no encontrada: ${template.categoryName}, usando Misceláneos`)
        const fallbackId = categoryMap.get("Miscellaneous / Others")
        if (!fallbackId) continue
      }

      const amount = randomBetween(
        template.amountRange[0],
        template.amountRange[1]
      )

      const description =
        template.descriptions[
          randomBetween(0, template.descriptions.length - 1)
        ]

      const accountId = accountIds[randomBetween(0, accountIds.length - 1)]
      const createdAt = getRandomDate(monthsAgo)

      await db.insert(transactions).values({
        userId,
        accountId,
        amount: amount.toFixed(2),
        transactionType: template.type,
        transactionDescription: description,
        categoryId: categoryId ?? categoryMap.get("Miscellaneous / Others")!,
        createdAt,
      })

      totalTransactions++
    }

    console.log(`  📅 Mes ${5 - monthsAgo + 1}: ${transactionsPerMonth} transacciones`)
  }

  console.log(`  ✅ Total: ${totalTransactions} transacciones creadas`)
}

async function main() {
  const userId = 1

  console.log("🚀 Iniciando seed de datos de prueba...\n")

  const categoryMap = await getCategoryMap()
  if (categoryMap.size === 0) {
    console.error("❌ No hay categorías en la base de datos. Ejecuta: npm run db:seed")
    process.exit(1)
  }

  console.log(`  📋 ${categoryMap.size} categorías encontradas\n`)

  const accountIds = await seedDemoAccounts(userId)
  await seedTransactions(userId, accountIds, categoryMap)

  console.log("\n🎉 ¡Seed de prueba completado!")
  console.log("   Ejecuta 'npm run dev' para ver los gráficos con datos reales.")

  await connection.end()
}

main().catch((err) => {
  console.error("❌ Error durante el proceso:", err)
  process.exit(1)
})
