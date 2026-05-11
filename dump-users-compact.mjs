import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.join(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

async function dumpUsers() {
    if (!supabaseUrl || !supabaseServiceKey) {
        console.error('❌ Error: Supabase URL or Service Key is missing')
        process.exit(1)
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const { data: users, error } = await supabase.from('users').select('id, name, role, branch, status, phone')

    if (error) {
        console.error('❌ Error fetching users:', error.message)
        return
    }

    console.log('--- ATHLETES ---')
    users.filter(u => u.role === 'athlete').forEach(u => {
        console.log(`[${u.id}] Name: ${u.name}, Status: ${u.status}, Branch: ${u.branch}, Phone: ${u.phone}`)
    })

    console.log('\n--- COACHES ---')
    users.filter(u => u.role === 'coach' || u.role === 'admin').forEach(u => {
        console.log(`[${u.id}] Name: ${u.name}, Role: ${u.role}, Branch: ${u.branch}, Phone: ${u.phone}`)
    })
}

dumpUsers()
