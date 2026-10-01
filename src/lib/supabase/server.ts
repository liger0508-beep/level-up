import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// Suppress Supabase's "Invalid Refresh Token" console error spam
const originalConsoleError = console.error;
console.error = (...args) => {
    if (typeof args[0] === 'string' && args[0].includes('AuthApiError') && args[0].includes('Refresh Token Not Found')) {
        return;
    }
    originalConsoleError(...args);
};

export async function createClient() {
    const cookieStore = await cookies()

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key';

    return createServerClient(
        url,
        key,
        {
            cookies: {
                getAll() {
                    return cookieStore.getAll()
                },
                setAll(cookiesToSet) {
                    try {
                        cookiesToSet.forEach(({ name, value, options }) =>
                            cookieStore.set(name, value, options)
                        )
                    } catch {
                        // The `setAll` method was called from a Server Component.
                        // This can be ignored if you have middleware refreshing
                        // user sessions.
                    }
                },
            },
        }
    )
}

export async function createAdminClient() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-key';

    return createServerClient(url, key, {
        cookies: {
            getAll() { return [] },
            setAll() { }
        }
    });
}
