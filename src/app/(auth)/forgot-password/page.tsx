import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

async function forgotPasswordAction(formData: FormData) {
    'use server'
    const email = formData.get('email') as string
    const supabase = await createClient()

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/auth/callback?next=/reset-password`,
    })

    if (error) {
        redirect(`/forgot-password?message=${encodeURIComponent('비밀번호 재설정 요청 중 오류가 발생했습니다.')}`)
    }

    redirect(`/forgot-password?message=${encodeURIComponent('비밀번호 재설정 링크가 이메일로 발송되었습니다.')}&success=true`)
}

export default async function ForgotPasswordPage(props: { searchParams: Promise<{ [key: string]: string | undefined }> }) {
    const searchParams = await props.searchParams;
    const isSuccess = searchParams.success === 'true'

    return (
        <div className="flex flex-col w-full gap-5">
            <div className="flex flex-col gap-1">
                <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">비밀번호 찾기</h3>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    가입하신 이메일 주소를 입력하시면 비밀번호 재설정 링크를 보내드립니다.
                </p>
            </div>

            <form className="flex flex-col w-full gap-5" action={forgotPasswordAction}>
                {searchParams?.message && (
                    <div className={`p-3 rounded-lg text-sm text-center font-medium ${isSuccess ? 'bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400'}`}>
                        {searchParams.message}
                    </div>
                )}
                
                <div className="flex flex-col gap-2">
                    <label className="text-sm font-semibold text-zinc-700 dark:text-zinc-300" htmlFor="email">
                        이메일
                    </label>
                    <input
                        className="rounded-lg px-4 py-2.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100 transition-all text-sm placeholder:text-zinc-400"
                        name="email"
                        placeholder="you@example.com"
                        required
                        type="email"
                    />
                </div>

                <button className="bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 font-semibold rounded-lg px-4 py-3 mt-2 transition-colors shadow-sm active:scale-[0.98]">
                    비밀번호 재설정 메일 보내기
                </button>
            </form>

            <div className="flex justify-center gap-3 text-sm text-zinc-500 dark:text-zinc-400 mt-2">
                <Link href="/login" className="hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">로그인으로 돌아가기</Link>
            </div>
        </div>
    )
}
