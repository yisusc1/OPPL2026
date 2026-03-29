const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
async function test() {
  const { data, error } = await supabase.from('equipos').select('*, miembros:equipo_miembros(*, profiles(id, first_name, last_name))');
  console.log('Error GET:', error);
  console.log('Data GET:', JSON.stringify(data, null, 2));
}
test();
