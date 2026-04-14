import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function test() {
    console.log("Checking A1 in inventory_serials...");
    const { data: serials } = await supabase.from('inventory_serials').select('*').eq('serial_number', 'A1');
    console.log(serials);

    console.log("\nChecking A1 in inventory_assignments...");
    const { data: asm } = await supabase.from('inventory_assignment_items').select('*').contains('serials', ['A1']);
    console.log(asm);

    console.log("\nChecking get_serial_history for A1");
    const { data: history, error } = await supabase.rpc('get_serial_history', { search_term: 'A1' });
    console.log(history);
    if(error) console.log(error);
}
test();
