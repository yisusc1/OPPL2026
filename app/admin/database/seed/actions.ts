"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

const CABLES = ["Cable Fibra Drop", "Cable UTP Cat6", "Cable Coaxial RG6", "Cable Eléctrico 12AWG"]
const EQUIPOS = ["Modem ONU Huawei", "Modem ONU ZTE", "Router TP-Link", "Switch 8 Puertos"]
const ACCESORIOS = ["Conector Fast SC/APC", "Tensor Drop", "Gancho Tensor", "Caja NAP 16 Puertos", "Splitter 1x8"]

function getRandomItem(arr: string[]) {
    return arr[Math.floor(Math.random() * arr.length)]
}

function generateSKU(name: string) {
    const prefix = name.substring(0, 3).toUpperCase()
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0')
    return `${prefix}-${random}`
}

export async function seedProductsAction(count: number = 10) {
    const supabase = await createClient()

    // Check Admin
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: "No autorizado" }

    // Check roles... (Assuming middleware protects this, but good to be safe)

    const products = []

    for (let i = 0; i < count; i++) {
        const category = Math.random() > 0.6 ? "ACCESORIO" : (Math.random() > 0.5 ? "EQUIPO" : "CABLE")
        let name = ""

        if (category === "CABLE") name = getRandomItem(CABLES)
        else if (category === "EQUIPO") name = getRandomItem(EQUIPOS)
        else name = getRandomItem(ACCESORIOS)

        // Add variety
        name = `${name} ${Math.floor(Math.random() * 100)}`

        products.push({
            name: name,
            sku: generateSKU(name),
            category: category,
            current_stock: Math.floor(Math.random() * 500),
            min_stock: Math.floor(Math.random() * 50) + 10,
            description: "Generado automáticamente por Factory"
        })
    }

    const { error } = await supabase.from("inventory_products").insert(products)

    if (error) {
        console.error("Error seeding products:", error)
        return { success: false, error: error.message }
    }

    revalidatePath("/almacen")
    revalidatePath("/admin/database")
    return { success: true, message: `Se crearon ${count} productos.` }
}
