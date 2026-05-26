import { login } from '../actions'
import Link from 'next/link'

export default async function LoginPage(props: { searchParams: Promise<{ [key: string]: string | undefined }> }) {
    const searchParams = await props.searchParams;
    return (
        <>
            <form className="flex flex-col w-full gap-5" action={login}>
                {searchParams?.message && (
                    <div className="p-3 bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400 rounded-lg text-sm text-center font-medium">
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
                <div className="flex flex-col gap-2">
                    <label className="text-sm font-semibold text-zinc-700 dark:text-zinc-300" htmlFor="password">
                        비밀번호
                    </label>
                    <input
                        className="rounded-lg px-4 py-2.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100 transition-all text-sm placeholder:text-zinc-400"
                        type="password"
                        name="password"
                        placeholder="••••••••"
                        required
                    />
                </div>
                <button className="bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 font-semibold rounded-lg px-4 py-3 mt-4 transition-colors shadow-sm active:scale-[0.98]">
                    로그인
                </button>
            </form>

            <div className="flex justify-center items-center gap-4 mt-8 pt-6 border-t border-zinc-100 dark:border-zinc-800">
                <Link 
                    href="/find-id" 
                    className="text-xs font-bold text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 transition-colors p-2"
                >
                    아이디 찾기
                </Link>
                <div className="w-px h-3 bg-zinc-200 dark:bg-zinc-800"></div>
                <Link 
                    href="/forgot-password" 
                    className="text-xs font-bold text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 transition-colors p-2"
                >
                    비밀번호 찾기
                </Link>
            </div>
            <p className="text-sm text-center text-zinc-500 dark:text-zinc-400 mt-2 font-medium">
                계정이 없으신가요? <Link href="/signup" className="text-zinc-900 dark:text-zinc-100 hover:underline transition-all">회원가입</Link>
            </p>
        </>
    )
}
