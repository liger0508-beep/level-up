import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import path from 'path'

// Load .env.local
dotenv.config({ path: path.join(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

async function testConnection() {
    if (!supabaseUrl || !supabaseAnonKey) {
        console.error('❌ Error: Supabase URL or Anon Key is missing in .env.local')
        process.exit(1)
    }

    console.log('Connecting to:', supabaseUrl)
    const supabase = createClient(supabaseUrl, supabaseAnonKey)

    try {
        const { data, error } = await supabase.from('users').select('*').limit(1)

        if (error) {
            console.error('❌ connection fail:', error.message)
            if (error.code === '42P01') {
                console.error('👉 Tip: Table "users" does not exist. Did you run the SQL script in Step 2?')
            }
        } else {
            console.log('✅ Success! Supabase connection is active.')
            console.log('Note: Table "users" exists and is accessible.')
        }
    } catch (err) {
        console.error('❌ Unexpected error:', err)
    }
}

testConnection()
