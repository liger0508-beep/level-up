export default function AuthLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-zinc-50 dark:bg-black">
            <div className="w-full max-w-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm p-6 lg:p-10">
                <div className="flex flex-col items-center mb-8 gap-2">
                    <div className="w-14 h-14 bg-zinc-900 dark:bg-white rounded-full flex items-center justify-center mb-2 shadow-sm">
                        <span className="text-white dark:text-zinc-900 font-bold text-xl tracking-tighter">GLA</span>
                    </div>
                    <h2 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">Level-Up Program</h2>
                </div>
                {children}
            </div>
        </div>
    )
}
