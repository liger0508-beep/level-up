import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  // Use dummy values during build if environment variables are missing to prevent crashes.
  // Real values must be set in Vercel dashboard for actual functionality.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key';

  return createBrowserClient(url, key);
}
