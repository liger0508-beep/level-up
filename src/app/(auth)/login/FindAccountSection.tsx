"use client";

import { useState } from "react";
import { X, Search, Key, CheckCircle2, AlertCircle } from "lucide-react";

type TabType = "id" | "password";

export default function FindAccountSection() {
    const [isOpen, setIsOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<TabType>("id");

    const [name, setName] = useState("");
    const [phone, setPhone] = useState("");
    const [email, setEmail] = useState("");

    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");
    const [result, setResult] = useState<string | null>(null);

    const openModal = (tab: TabType) => {
        setActiveTab(tab);
        setIsOpen(true);
        resetState();
    };

    const closeModal = () => {
        setIsOpen(false);
        resetState();
    };

    const resetState = () => {
        setName("");
        setPhone("");
        setEmail("");
        setError("");
        setResult(null);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setResult(null);

        if (!name.trim()) return setError("이름을 입력해주세요.");
        if (!phone.trim()) return setError("연락처를 입력해주세요.");

        if (activeTab === "password" && !email.trim()) {
            return setError("이메일을 입력해주세요.");
        }

        const numericPhone = phone.replace(/[^0-9]/g, "");
        if (numericPhone.length < 4) return setError("올바른 연락처를 입력해주세요.");

        setIsLoading(true);
        try {
            const res = await fetch("/api/auth/find-account", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: activeTab,
                    name,
                    phone: numericPhone,
                    email: activeTab === "password" ? email : undefined
                })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "처리 중 오류가 발생했습니다.");

            if (activeTab === "id") {
                setResult(data.email);
            } else {
                setResult(data.message);
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <>
            <div className="flex justify-center items-center gap-4 mt-8 pt-6 border-t border-zinc-100 dark:border-zinc-800">
                <button
                    type="button"
                    onClick={() => openModal("id")}
                    className="text-xs font-bold text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 transition-colors p-2"
                >
                    아이디 찾기
                </button>
                <div className="w-px h-3 bg-zinc-200 dark:bg-zinc-800"></div>
                <button
                    type="button"
                    onClick={() => openModal("password")}
                    className="text-xs font-bold text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 transition-colors p-2"
                >
                    비밀번호 찾기
                </button>
            </div>

            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                        {/* Header */}
                        <div className="flex items-center justify-between p-4 border-b border-zinc-100 dark:border-zinc-800">
                            <div className="flex gap-4">
                                <button
                                    onClick={() => { setActiveTab("id"); resetState(); }}
                                    className={`text-sm font-bold pb-1 transition-colors ${activeTab === "id"
                                        ? "text-brand-navy dark:text-blue-400 border-b-2 border-brand-navy dark:border-blue-400"
                                        : "text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                                        }`}
                                >
                                    아이디 찾기
                                </button>
                                <button
                                    onClick={() => { setActiveTab("password"); resetState(); }}
                                    className={`text-sm font-bold pb-1 transition-colors ${activeTab === "password"
                                        ? "text-brand-navy dark:text-blue-400 border-b-2 border-brand-navy dark:border-blue-400"
                                        : "text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                                        }`}
                                >
                                    비밀번호 찾기
                                </button>
                            </div>
                            <button onClick={closeModal} className="p-1 rounded-full text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                                <X size={20} />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="p-6">
                            {result ? (
                                <div className="flex flex-col items-center text-center py-8">
                                    <CheckCircle2 size={48} className="text-emerald-500 mb-4" />
                                    {activeTab === "id" ? (
                                        <>
                                            <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-2">아이디 확인</h3>
                                            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">입력하신 정보와 일치하는 아이디입니다.</p>
                                            <div className="px-6 py-3 bg-zinc-50 dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700">
                                                <span className="text-lg font-bold text-brand-navy dark:text-blue-400">{result}</span>
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-2">비밀번호 초기화 완료</h3>
                                            <p className="text-sm text-zinc-600 dark:text-zinc-300 bg-emerald-50 dark:bg-emerald-500/10 p-4 rounded-xl leading-relaxed">
                                                {result.split('\n').map((line, i) => (
                                                    <span key={i}>{line}<br /></span>
                                                ))}
                                            </p>
                                        </>
                                    )}
                                    <button
                                        onClick={closeModal}
                                        className="mt-8 w-full px-4 py-3 rounded-xl bg-brand-navy text-white text-sm font-bold transition-opacity hover:opacity-90"
                                    >
                                        로그인하러 가기
                                    </button>
                                </div>
                            ) : (
                                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                                    {error && (
                                        <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 text-sm font-medium rounded-xl">
                                            <AlertCircle size={16} />
                                            {error}
                                        </div>
                                    )}

                                    {activeTab === "password" && (
                                        <div className="space-y-1.5">
                                            <label className="text-sm font-bold text-zinc-700 dark:text-zinc-300">아이디 (이메일)</label>
                                            <input
                                                type="email"
                                                placeholder="가입 시 이메일"
                                                value={email}
                                                onChange={(e) => setEmail(e.target.value)}
                                                className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-brand-navy/30 transition-all text-sm font-semibold"
                                            />
                                        </div>
                                    )}

                                    <div className="space-y-1.5">
                                        <label className="text-sm font-bold text-zinc-700 dark:text-zinc-300">이름</label>
                                        <input
                                            type="text"
                                            placeholder="가입 시 이름"
                                            value={name}
                                            onChange={(e) => setName(e.target.value)}
                                            className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-brand-navy/30 transition-all text-sm font-semibold"
                                        />
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="text-sm font-bold text-zinc-700 dark:text-zinc-300">연락처</label>
                                        <input
                                            type="text"
                                            placeholder="가입 시 연락처 (숫자만 입력)"
                                            value={phone}
                                            onChange={(e) => setPhone(e.target.value)}
                                            className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-brand-navy/30 transition-all text-sm font-semibold"
                                        />
                                    </div>

                                    <button
                                        type="submit"
                                        disabled={isLoading}
                                        className="mt-2 w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-brand-navy text-white text-sm font-bold disabled:opacity-50 transition-opacity hover:opacity-90"
                                    >
                                        {isLoading ? "확인 중..." : (
                                            <>
                                                {activeTab === "id" ? <Search size={16} /> : <Key size={16} />}
                                                {activeTab === "id" ? "아이디 찾기" : "비밀번호 초기화"}
                                            </>
                                        )}
                                    </button>
                                </form>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}