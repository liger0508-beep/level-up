import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { SignJWT } from 'jose';

// Secret key for signing (you should use an env var in production)
const SECRET = new TextEncoder().encode(
    process.env.SUPABASE_SERVICE_ROLE_KEY || 'default-secret-key-fallback'
);

export async function GET() {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Token expires in 3 minutes
        const token = await new SignJWT({ athleteId: user.id })
            .setProtectedHeader({ alg: 'HS256' })
            .setIssuedAt()
            .setExpirationTime('3m')
            .sign(SECRET);

        return NextResponse.json({ token, expires_in: 180 });
    } catch (error: any) {
        console.error('QR Token error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
