'use client'

import { signup } from '../actions'
import Link from 'next/link'
import { FormEvent, useRef, useState, use } from 'react'

export default function SignupPage(props: { searchParams: Promise<{ [key: string]: string | undefined }> }) {
    const searchParams = use(props.searchParams);
    const [passwordError, setPasswordError] = useState('');
    const [selectedRole, setSelectedRole] = useState('athlete');
    const formRef = useRef<HTMLFormElement>(null);

    const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setPasswordError('');

        const formData = new FormData(e.currentTarget);
        const password = formData.get('password') as string;
        const confirmPassword = formData.get('confirmPassword') as string;

        if (password !== confirmPassword) {
            setPasswordError('비밀번호가 일치하지 않습니다.');
            return;
        }

        // If validation passes, manually submit the form data to the server action
        const submitAction = async () => {
            const result = await signup(formData);
        }
        submitAction();
    };


    return (
        <form ref={formRef} className="flex flex-col w-full gap-5" onSubmit={handleSubmit}>
            {searchParams?.message && (
                <div className="p-3 bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400 rounded-lg text-sm text-center font-medium">
                    {searchParams.message}
                </div>
            )}
            {passwordError && (
                <div className="p-3 bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400 rounded-lg text-sm text-center font-medium">
                    {passwordError}
                </div>
            )}
            <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold text-zinc-700 dark:text-zinc-300" htmlFor="name">
                    이름(실명)
                </label>
                <input
                    className="rounded-lg px-4 py-2.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100 transition-all text-sm placeholder:text-zinc-400"
                    name="name"
                    placeholder="홍길동"
                    required
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
                />
            </div>
            <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold text-zinc-700 dark:text-zinc-300" htmlFor="role">
                    역할
                </label>
                <select
                    className="rounded-lg px-4 py-2.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100 transition-all text-sm appearance-none font-medium"
                    name="role"
                    required
                    defaultValue="athlete"
                    onChange={(e) => setSelectedRole(e.target.value)}
                >
                    <option value="athlete">선수 (Athlete)</option>
                    <option value="coach">코치 (Coach)</option>
                    <option value="parent">학부모 (Parent)</option>
                </select>
                <p className="text-[11px] text-zinc-500">주의: 학부모 및 코치 계정은 관리자의 승인이 필요할 수 있습니다.</p>
            </div>
            <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold text-zinc-700 dark:text-zinc-300" htmlFor="branch">
                    지점
                </label>
                <select
                    className="rounded-lg px-4 py-2.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100 transition-all text-sm appearance-none font-medium"
                    name="branch"
                    required
                    defaultValue="조이마루점"
                >
                    {selectedRole === 'coach' && <option value="오피스">오피스</option>}
                    <option value="조이마루점">조이마루점</option>
                    <option value="구미점">구미점</option>
                </select>
            </div>
            <div className="flex flex-col gap-2 relative">
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
                    placeholder="•••••••• (최소 6자 이상)"
                    required
                    minLength={6}
                />
            </div>
            <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold text-zinc-700 dark:text-zinc-300" htmlFor="confirmPassword">
                    비밀번호 확인
                </label>
                <input
                    className="rounded-lg px-4 py-2.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100 transition-all text-sm placeholder:text-zinc-400"
                    type="password"
                    name="confirmPassword"
                    placeholder="비밀번호를 다시 입력해주세요"
                    required
                    minLength={6}
                />
            </div>
            <button className="bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 font-semibold rounded-lg px-4 py-3 mt-4 transition-colors shadow-sm active:scale-[0.98]">
                가입하기
            </button>
            <p className="text-sm text-center text-zinc-500 dark:text-zinc-400 mt-2 font-medium">
                이미 계정이 있으신가요? <Link href="/login" className="text-zinc-900 dark:text-zinc-100 hover:underline transition-all">로그인</Link>
            </p>
        </form>
    )
}
