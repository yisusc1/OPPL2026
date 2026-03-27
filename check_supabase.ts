import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import { resolve } from 'path'

const envPath = resolve(process.cwd(), '.env.local')
const envData = fs.readFileSync(envPath, 'utf-8')
envData.split('\n').forEach(line => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/)
    if (match) {
        const key = match[1]
        let value = match[2] || ''
        value = value.replace(/^['"]|['"]$/g, '')
        process.env[key] = value
    }
})

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
    process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function check() {
    const payload = {
        codigo: "TEST-01",
        placa: "TEST-123",
        modelo: "Test Model",
        año: "2024",
        color: "White",
        tipo: "Particular",
        capacidad_tanque: "80",
        foto_url: "",
        department: "",
        assigned_driver_id: null
    };

    const { error: insertError } = await supabase.from('vehiculos').insert(payload)
    console.log("Test Insert Error with real payload:", JSON.stringify(insertError, null, 2))
}

check()
