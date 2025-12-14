
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTables() {
  const { data, error } = await supabase.from('disciplines').select('*').limit(1);
  if (error) {
    console.log('Error accessing disciplines table:', error.message);
    // Try categories
    const { data: catData, error: catError } = await supabase.from('categories').select('*').limit(1);
    if (catError) {
        console.log('Error accessing categories table:', catError.message);
    } else {
        console.log('Found categories table');
    }
  } else {
    console.log('Found disciplines table');
  }
}

checkTables();
