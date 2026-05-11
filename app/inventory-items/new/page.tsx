import { createTestTransaction } from "@/app/actions"

export default async function NewInventoryItem() {
  return (
    <section>
      <header>Nuevo producto</header>
      <div className="mt-5">
        <form action={createTestTransaction}>
          <button
            type="submit"
            className="mt-4 rounded bg-blue-500 px-4 py-2 text-white"
          >
            Insertar Gasto de Prueba
          </button>
        </form>
      </div>
    </section>
  )
}
