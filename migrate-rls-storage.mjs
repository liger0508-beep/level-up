import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

function getEnv() {
    const envPath = path.join(process.cwd(), '.env.local');
    const content = fs.readFileSync(envPath, 'utf8');
    const env = {};
    content.split('\n').filter(l => l.trim()).forEach(line => {
        const [key, ...value] = line.split('=');
        if (key && value) env[key.trim()] = value.join('=').trim();
    });
    return env;
}

async function migrate() {
    const env = getEnv();
    const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

    console.log('--- Applying RLS Fix and Storage Setup ---');

    // 1. RLS Fix for records table
    const rlsSql = `
        DROP POLICY IF EXISTS "Allow insert for testing" ON public.records;
        CREATE POLICY "Allow insert for testing" ON public.records FOR INSERT WITH CHECK ( true );
    `;

    const { error: rlsError } = await supabase.rpc('execute_sql', { sql_string: rlsSql });
    if (rlsError) console.error('RLS Migration failed:', rlsError.message);
    else console.log('Successfully added temporary RLS insert policy.');

    // 2. Storage Bucket Creation
    const { data: buckets, error: getBucketsError } = await supabase.storage.listBuckets();
    if (getBucketsError) {
        console.error('Failed to list buckets:', getBucketsError.message);
    } else {
        const recordsBucket = buckets.find(b => b.id === 'records');
        if (!recordsBucket) {
            console.log('Creating "records" bucket...');
            const { error: createError } = await supabase.storage.createBucket('records', {
                public: true,
                allowedMimeTypes: ['image/*', 'video/*'],
            });
            if (createError) console.error('Failed to create bucket:', createError.message);
            else console.log('Successfully created "records" bucket.');
        } else {
            console.log('"records" bucket already exists.');
        }
    }

    // 3. Storage RLS Policies (to allow anonymous uploads for dev, or at least authenticated if needed)
    // For now, let's just make sure it's public and allow inserts.
    const storageRlsSql = `
        -- Allow public access to read
        DROP POLICY IF EXISTS "Public Access" ON storage.objects;
        CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING ( bucket_id = 'records' );

        -- Allow all users to upload for now
        DROP POLICY IF EXISTS "Allow upload for all" ON storage.objects;
        CREATE POLICY "Allow upload for all" ON storage.objects FOR INSERT WITH CHECK ( bucket_id = 'records' );
    `;
    const { data: storageRlsData, error: storageRlsError } = await supabase.rpc('execute_sql', { sql_string: storageRlsSql });
    if (storageRlsError) {
        console.error('Storage RLS Migration failed!');
        console.error('Error Status:', storageRlsError.status);
        console.error('Error Message:', storageRlsError.message);
        console.error('Error Details:', storageRlsError.details);
    } else {
        console.log('Successfully added Storage RLS policies.');
    }
}

migrate();
