'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function ResetPasswordPage() {
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [error, setError] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)
    const router = useRouter()

    const handleReset = async (e: React.FormEvent) => {
        e.preventDefault()
        if (password !== confirmPassword) {
            setError('비밀번호가 일치하지 않습니다.')
            return
        }

        setLoading(true)
        setError(null)

        const supabase = createClient()
        const { error: resetError } = await supabase.auth.updateUser({
            password: password
        })

        if (resetError) {
            setError('비밀번호 변경 중 오류가 발생했습니다: ' + resetError.message)
        } else {
            alert('비밀번호가 성공적으로 변경되었습니다. 다시 로그인해주세요.')
            router.push('/login')
        }
        
        setLoading(false)
    }

    return (
        <div className="flex flex-col w-full gap-5">
            <div className="flex flex-col gap-1">
                <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">새 비밀번호 설정</h3>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    새롭게 사용할 비밀번호를 입력해주세요.
                </p>
            </div>

            <form className="flex flex-col w-full gap-5" onSubmit={handleReset}>
                {error && (
                    <div className="p-3 bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400 rounded-lg text-sm text-center font-medium">
                        {error}
                    </div>
                )}
                
                <div className="flex flex-col gap-2">
                    <label className="text-sm font-semibold text-zinc-700 dark:text-zinc-300" htmlFor="password">
                        새 비밀번호
                    </label>
                    <input
                        className="rounded-lg px-4 py-2.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100 transition-all text-sm placeholder:text-zinc-400"
                        name="password"
                        type="password"
                        placeholder="••••••••"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        minLength={6}
                    />
                </div>

                <div className="flex flex-col gap-2">
                    <label className="text-sm font-semibold text-zinc-700 dark:text-zinc-300" htmlFor="confirmPassword">
                        비밀번호 확인
                    </label>
                    <input
                        className="rounded-lg px-4 py-2.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100 transition-all text-sm placeholder:text-zinc-400"
                        name="confirmPassword"
                        type="password"
                        placeholder="••••••••"
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        minLength={6}
                    />
                </div>

                <button 
                    disabled={loading}
                    className="bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-50 font-semibold rounded-lg px-4 py-3 mt-2 transition-colors shadow-sm active:scale-[0.98]"
                >
                    {loading ? '변경 중...' : '비밀번호 변경하기'}
                </button>
            </form>
        </div>
    )
}
