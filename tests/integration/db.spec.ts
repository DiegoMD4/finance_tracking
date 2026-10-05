import { describe, expect, it, beforeEach } from "vitest"
import { db } from "@/db";
import { users } from "@/db/schema/schema"
import { truncateDatabase } from "../setup/db"

beforeEach(async()=>{
    await truncateDatabase()
});

describe('test database check', ()=>{
    it("inserta y lee un usuario", async()=>{
        const inserted = await db
          .insert(users)
          .values({ name: "Test", email: "test@test.com", password: "x" }).$returningId()

        const rows = await db.select().from(users);
        expect(rows).toHaveLength(1)
        expect(inserted[0].id).toBeDefined()
    })
});