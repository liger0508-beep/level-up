import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

function getEnv() {
    const envPath = path.join(process.cwd(), '.env.local');
    const content = fs.readFileSync(envPath, 'utf8');
    const env = {};
    content.split('\n').forEach(line => {
        const [key, ...value] = line.split('=');
        if (key && value) env[key.trim()] = value.join('=').trim();
    });
    return env;
}

async function checkRoles() {
    const env = getEnv();
    const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

    const { data, error } = await supabase.from('users').select('id, name, role');
    if (error) {
        console.error("Error fetching users:", error);
    } else {
        const roles = {};
        data.forEach(u => {
            roles[u.role] = (roles[u.role] || 0) + 1;
        });
        console.log("Roles distribution:", roles);

        // Find admins and coaches
        const privileged = data.filter(u => ['admin', 'coach'].includes(u.role));
        console.log("Privileged users sample:", privileged.slice(0, 5));
    }
}

checkRoles();
