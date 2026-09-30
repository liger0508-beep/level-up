const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

async function checkUser() {
  const { data: userData, error: userError } = await supabase.from('users').select('id, name').eq('name', '황정욱1').single();
  
  if (userData) {
    console.log('Target user found:', userData);
    
    // Attempt delete public.users first
    const { error: dbError } = await supabase.from('users').delete().eq('id', userData.id);
    console.log('Delete public.users result:', dbError);

    // Attempt delete auth.users
    const { error: authError } = await supabase.auth.admin.deleteUser(userData.id);
    console.log('Delete auth.users result:', authError);
  } else {
    console.log('User not found in public.users', userError);
  }
}
checkUser();
