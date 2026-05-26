const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env.local');
const envFile = fs.readFileSync(envPath, 'utf-8');
const env = {};
envFile.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    const key = parts[0].trim();
    const value = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
    env[key] = value;
  }
});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

// We need to use postgres-meta API or we can just try executing sql using a known RPC if it exists.
// Or we can just use the Postgres connection string directly if it's in the env.
async function run() {
  if (env.DATABASE_URL) {
    const { Client } = require('pg');
    const client = new Client({ connectionString: env.DATABASE_URL });
    await client.connect();
    const res = await client.query(`
      SELECT policyname, permissive, roles, cmd, qual, with_check 
      FROM pg_policies 
      WHERE tablename = 'scorecard_holes'
    `);
    console.log('scorecard_holes policies:', JSON.stringify(res.rows, null, 2));
    
    const res2 = await client.query(`
      SELECT policyname, permissive, roles, cmd, qual, with_check 
      FROM pg_policies 
      WHERE tablename = 'scorecard_shots'
    `);
    console.log('scorecard_shots policies:', JSON.stringify(res2.rows, null, 2));

    await client.end();
  } else {
    console.log("No DATABASE_URL found.");
  }
}
run();
