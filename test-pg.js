const { Client } = require('pg');
const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8').split('\n').reduce((acc, line) => { const [k, v] = line.split('='); if(k && v) acc[k.trim()] = v.trim(); return acc; }, {});

const client = new Client({ connectionString: env.DATABASE_URL });
client.connect().then(() => {
    client.query("SELECT polname, polcmd, polqual, polroles FROM pg_policy WHERE polrelid = 'public.records'::regclass").then(res => {
        console.log(res.rows);
        client.end();
    });
});
