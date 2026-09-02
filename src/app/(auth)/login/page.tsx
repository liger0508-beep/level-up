import { login } from '../actions'
import Link from 'next/link'
import FindAccountSection from './FindAccountSection'

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

            <FindAccountSection />
            <div className="flex flex-col mt-6">
                <p className="text-sm text-center text-zinc-500 dark:text-zinc-400 font-medium mb-3">
                    계정이 없으신가요?
                </p>
                <Link
                    href="/signup"
                    className="bg-blue-900 dark:bg-blue-800 text-white hover:bg-blue-800 dark:hover:bg-blue-700 font-semibold rounded-lg px-4 py-3 transition-colors shadow-sm active:scale-[0.98] text-center"
                >
                    회원가입
                </Link>
            </div>
        </>
    )
}
