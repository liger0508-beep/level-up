import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

// We need to bypass the nextjs client and use the generic one for node
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

import { calculateAnalysisFromHoles } from './src/lib/score-calculations';

// Mock the createClient inside score-calculations by overriding it?
// Actually score-calculations uses './supabase/client' which uses createBrowserClient.
// That might fail in node environment because it's a server/browser mixed component.
