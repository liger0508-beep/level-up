'use client'

import Link from 'next/link'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function FindIdPage() {
    const [name, setName] = useState('')
    const [phone, setPhone] = useState('')
    const [foundEmail, setFoundEmail] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)

    const handleFindId = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError(null)
        setFoundEmail(null)

        const supabase = createClient()
        
        // 검색 쿼리: 이름과 휴대폰 번호로 이메일 찾기
        const { data, error: fetchError } = await supabase
            .from('users')
            .select('email')
            .eq('name', name)
            .eq('phone', phone)
            .maybeSingle()

        if (fetchError) {
            setError('정보를 불러오는 중 오류가 발생했습니다.')
        } else if (data) {
            setFoundEmail(data.email)
        } else {
            setError('일치하는 사용자 정보를 찾을 수 없습니다.')
        }
        
        setLoading(false)
    }

    return (
        <div className="flex flex-col w-full gap-5">
            <div className="flex flex-col gap-1">
                <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">아이디 찾기</h3>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    가입 시 입력하신 이름과 휴대폰 번호를 입력해주세요.
                </p>
            </div>

            {foundEmail ? (
                <div className="flex flex-col gap-6 items-center py-4">
                    <div className="p-6 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl w-full text-center">
                        <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-2">찾으시는 이메일 주소는 다음과 같습니다.</p>
                        <p className="text-xl font-bold text-zinc-900 dark:text-zinc-50">{foundEmail}</p>
                    </div>
                    <Link 
                        href="/login" 
                        className="w-full bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 text-center font-semibold rounded-lg px-4 py-3 transition-colors shadow-sm active:scale-[0.98]"
                    >
                        로그인하러 가기
                    </Link>
                </div>
            ) : (
                <form className="flex flex-col w-full gap-5" onSubmit={handleFindId}>
                    {error && (
                        <div className="p-3 bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400 rounded-lg text-sm text-center font-medium">
                            {error}
                        </div>
                    )}
                    
                    <div className="flex flex-col gap-2">
                        <label className="text-sm font-semibold text-zinc-700 dark:text-zinc-300" htmlFor="name">
                            이름
                        </label>
                        <input
                            className="rounded-lg px-4 py-2.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100 transition-all text-sm placeholder:text-zinc-400"
                            name="name"
                            placeholder="홍길동"
                            required
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                        />
                    </div>

                    <div className="flex flex-col gap-2">
                        <label className="text-sm font-semibold text-zinc-700 dark:text-zinc-300" htmlFor="phone">
                            휴대폰 번호
                        </label>
                        <input
                            className="rounded-lg px-4 py-2.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100 transition-all text-sm placeholder:text-zinc-400"
                            name="phone"
                            placeholder="010-0000-0000"
                            required
                            type="tel"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                        />
                    </div>

                    <button 
                        disabled={loading}
                        className="bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-50 font-semibold rounded-lg px-4 py-3 mt-2 transition-colors shadow-sm active:scale-[0.98]"
                    >
                        {loading ? '검색 중...' : '아이디 찾기'}
                    </button>
                </form>
            )}

            <div className="flex justify-center gap-3 text-sm text-zinc-500 dark:text-zinc-400 mt-2">
                <Link href="/login" className="hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">로그인으로 돌아가기</Link>
            </div>
        </div>
    )
}
