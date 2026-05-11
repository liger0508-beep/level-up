import { NextResponse } from 'next/server';

export async function POST(req: Request) {
    // SG 계산 기능은 사용자의 요청에 따라 비활성화되었습니다.
    // 로우 데이터 기록만 사용합니다.
    return NextResponse.json({ success: true, message: 'SG calculation is disabled.' });
}
