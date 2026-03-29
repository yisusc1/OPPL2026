import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
    const supabase = await createClient();
    const { data, error } = await supabase
        .from("equipos")
        .select("*, miembros:equipo_miembros(*, profile:profiles(id, first_name, last_name, department, job_title))")
        .eq("activo", true)
        .order("nombre");
        
    return NextResponse.json({ data, error });
}
