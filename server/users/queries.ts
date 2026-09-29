import { db } from "@/db"
import { users } from "@/db/schema/schema"
import { ServerUser } from "@/types/users.types"
import { eq } from "drizzle-orm"

export async function getUserById(id: number): Promise<{
  success: boolean
  data?: ServerUser
  error?: string
}> {
  try {
    const user = await db
      .select({ id: users.id, name: users.name, email: users.email })
      .from(users)
      .where(eq(users.id, id))
      .then((res) => res[0])

    if (!user) {
      return { success: false, error: "User not found" }
    }
    return { success: true, data: user }
  } catch (error) {
    console.error("❌ Error fetching user:", error)
    return { success: false, error: "Failed to fetch user" }
  }
}