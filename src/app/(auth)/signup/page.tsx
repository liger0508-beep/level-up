'use client'

import { signup } from '../actions'
import Link from 'next/link'
import { FormEvent, useRef, useState, use } from 'react'

export default function SignupPage(props: { searchParams: Promise<{ [key: string]: string | undefined }> }) {
    const searchParams = use(props.searchParams);
    const [passwordError, setPasswordError] = useState('');
    const [selectedRole, setSelectedRole] = useState('athlete');
    const [phone, setPhone] = useState('');
    const [isVerifying, setIsVerifying] = useState(false);
    
    // Privacy policy state
    const [agreements, setAgreements] = useState({
        age: false,
        terms: false,
        privacy: false,
        marketing: false,
    });
    const [showTerms, setShowTerms] = useState(false);
    const [showPrivacy, setShowPrivacy] = useState(false);
    const [showMarketing, setShowMarketing] = useState(false);

    const formRef = useRef<HTMLFormElement>(null);

    const handleAllAgree = (e: React.ChangeEvent<HTMLInputElement>) => {
        const checked = e.target.checked;
        setAgreements({ age: checked, terms: checked, privacy: checked, marketing: checked });
    };

    const handleAgreeChange = (key: keyof typeof agreements) => (e: React.ChangeEvent<HTMLInputElement>) => {
        setAgreements(prev => ({ ...prev, [key]: e.target.checked }));
    };

    const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let value = e.target.value.replace(/[^0-9]/g, '');
        if (value.length > 3 && value.length <= 7) {
            value = value.replace(/^(\d{3})(\d{1,4})$/, '$1-$2');
        } else if (value.length > 7) {
            value = value.replace(/^(\d{3})(\d{3,4})(\d{1,4})$/, '$1-$2-$3');
        }
        setPhone(value.slice(0, 13)); // Limit to max 13 characters (e.g. 010-1234-5678)
    };

    const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setPasswordError('');

        if (!agreements.age || !agreements.terms || !agreements.privacy) {
            setPasswordError('필수 약관에 모두 동의해주세요.');
            return;
        }

        const formData = new FormData(e.currentTarget);
        const password = formData.get('password') as string;
        const confirmPassword = formData.get('confirmPassword') as string;
        const role = formData.get('role') as string;
        const name = formData.get('name') as string;
        const branch = formData.get('branch') as string;

        formData.append('marketing_agreed', agreements.marketing.toString());

        if (password !== confirmPassword) {
            setPasswordError('비밀번호가 일치하지 않습니다.');
            return;
        }

        setIsVerifying(true);

        try {
            if (role === 'parent') {
                // Verify athlete details
                const verifyRes = await fetch('/api/auth/verify-athlete', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name, phone, branch })
                });

                const verifyData = await verifyRes.json();

                if (!verifyRes.ok) {
                    setPasswordError(verifyData.error || '선수 인증에 실패했습니다.');
                    setIsVerifying(false);
                    return;
                }

                // Override name with parent display name
                formData.set('name', verifyData.parentDisplayName);
                // Append athlete_id to pass it to the server action
                formData.append('athlete_id', verifyData.athleteId);
            }

            // If validation passes, manually submit the form data to the server action
            await signup(formData);
        } catch (error) {
            console.error(error);
            setPasswordError('가입 처리 중 오류가 발생했습니다.');
        } finally {
            setIsVerifying(false);
        }
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
                <label className="text-sm font-semibold text-zinc-700 dark:text-zinc-300" htmlFor="role">
                    역할
                </label>
                <select
                    className="rounded-lg px-4 py-2.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100 transition-all text-sm appearance-none font-medium"
                    name="role"
                    required
                    value={selectedRole}
                    onChange={(e) => setSelectedRole(e.target.value)}
                >
                    <option value="athlete">선수 (Athlete)</option>
                    <option value="coach">코치 (Coach)</option>
                    <option value="parent">학부모 (Parent)</option>
                </select>
                <p className="text-[11px] text-zinc-500">주의: 학부모 및 코치 계정은 관리자의 승인이 필요할 수 있습니다.</p>
            </div>
            <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold text-zinc-700 dark:text-zinc-300" htmlFor="name">
                    {selectedRole === 'parent' ? '선수 이름(실명)' : '이름(실명)'}
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
                    {selectedRole === 'parent' ? '선수 휴대폰 번호' : '휴대폰 번호'}
                </label>
                <input
                    className="rounded-lg px-4 py-2.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100 transition-all text-sm placeholder:text-zinc-400"
                    name="phone"
                    placeholder="010-0000-0000"
                    required
                    type="tel"
                    value={phone}
                    onChange={handlePhoneChange}
                />
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
            
            <div className="flex flex-col gap-2 mt-2">
                <div className="flex items-center gap-2 pb-3 border-b border-zinc-200 dark:border-zinc-800">
                    <input type="checkbox" id="agreeAll" className="w-4 h-4 rounded border-zinc-300"
                        checked={agreements.age && agreements.terms && agreements.privacy && agreements.marketing}
                        onChange={handleAllAgree}
                    />
                    <label htmlFor="agreeAll" className="text-sm font-bold text-zinc-900 dark:text-zinc-100 cursor-pointer">
                        전체 동의하기
                    </label>
                </div>
                
                <div className="flex items-center gap-2 mt-1">
                    <input type="checkbox" id="agreeAge" className="w-4 h-4 rounded border-zinc-300"
                        checked={agreements.age} onChange={handleAgreeChange('age')}
                    />
                    <label htmlFor="agreeAge" className="text-sm text-zinc-700 dark:text-zinc-300 cursor-pointer flex-1">
                        (필수) 만 14세 이상입니다.
                    </label>
                </div>

                <div className="flex flex-col gap-1 mt-1">
                    <div className="flex items-center gap-2">
                        <input type="checkbox" id="agreeTerms" className="w-4 h-4 rounded border-zinc-300"
                            checked={agreements.terms} onChange={handleAgreeChange('terms')}
                        />
                        <label htmlFor="agreeTerms" className="text-sm text-zinc-700 dark:text-zinc-300 cursor-pointer flex-1">
                            (필수) 서비스 이용약관 동의
                        </label>
                        <button type="button" onClick={() => setShowTerms(!showTerms)} className="text-[11px] text-zinc-500 underline underline-offset-2">
                            {showTerms ? '접기' : '내용보기'}
                        </button>
                    </div>
                    {showTerms && (
                        <div className="p-3 bg-zinc-50 dark:bg-zinc-900/50 rounded text-xs text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-800 max-h-48 overflow-y-auto mt-1 space-y-2 whitespace-pre-wrap">
                            <p className="font-bold">제1조 (목적)</p>
                            <p>본 약관은 GLA Level-Up(이하 "회사")이 제공하는 제반 서비스의 이용과 관련하여 회사와 회원과의 권리, 의무 및 책임사항을 규정함을 목적으로 합니다.</p>
                            
                            <p className="font-bold">제2조 (용어의 정의)</p>
                            <p>"회원"이라 함은 회사의 서비스에 접속하여 본 약관에 따라 회사와 이용계약을 체결하고 회사가 제공하는 서비스를 이용하는 고객(선수, 코치, 학부모 등)을 말합니다.</p>
                            
                            <p className="font-bold">제3조 (회원가입 및 계정 관리)</p>
                            <p>1. 회원가입은 가입을 희망하는 자가 본 약관 및 개인정보 처리방침에 동의한 후 회사가 정한 양식에 따라 정보를 기입하여 신청하고 회사가 승낙함으로써 완료됩니다.<br/>
                               2. 회원의 계정 및 비밀번호에 대한 관리 책임은 회원 본인에게 있으며, 제3자에게 이용하게 해서는 안 됩니다.</p>

                            <p className="font-bold">제4조 (회사의 의무)</p>
                            <p>회사는 관련 법령과 본 약관이 금지하는 행위를 하지 않으며, 계속적이고 안정적으로 서비스를 제공하기 위하여 최선을 다하여 노력합니다.</p>

                            <p className="font-bold">제5조 (회원의 의무)</p>
                            <p>1. 회원은 타인의 정보를 도용하거나 허위 내용의 등록을 해서는 안 됩니다.<br/>
                               2. 회원은 회사의 사전 승낙 없이 서비스를 이용하여 영업활동을 할 수 없으며, 다른 회원의 서비스 이용을 방해해서는 안 됩니다.</p>

                            <p className="font-bold">제6조 (계약해지 및 이용제한)</p>
                            <p>1. 회원은 언제든지 서비스 내 설정 또는 고객센터를 통하여 이용계약 해지(회원탈퇴)를 신청할 수 있습니다.<br/>
                               2. 회원이 본 약관의 의무를 위반하거나 서비스의 정상적인 운영을 방해한 경우, 회사는 사전 통지 후 계정 정지, 직권 탈퇴 등의 조치를 취할 수 있습니다.</p>
                        </div>
                    )}
                </div>

                <div className="flex flex-col gap-1 mt-1">
                    <div className="flex items-center gap-2">
                        <input type="checkbox" id="agreePrivacy" className="w-4 h-4 rounded border-zinc-300"
                            checked={agreements.privacy} onChange={handleAgreeChange('privacy')}
                        />
                        <label htmlFor="agreePrivacy" className="text-sm text-zinc-700 dark:text-zinc-300 cursor-pointer flex-1">
                            (필수) 개인정보 수집 및 이용 동의
                        </label>
                        <button type="button" onClick={() => setShowPrivacy(!showPrivacy)} className="text-[11px] text-zinc-500 underline underline-offset-2">
                            {showPrivacy ? '접기' : '내용보기'}
                        </button>
                    </div>
                    {showPrivacy && (
                        <div className="p-3 bg-zinc-50 dark:bg-zinc-900/50 rounded text-xs text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-800 mt-1">
                            <strong>수집 항목:</strong> 이름, 휴대폰 번호, 지점, 이메일, 비밀번호<br/>
                            <strong>수집 목적:</strong> 회원 식별, 서비스 제공 및 고객 상담<br/>
                            <strong>보유 기간:</strong> 회원 탈퇴 시까지<br/>
                            * 동의를 거부할 권리가 있으나, 거부 시 서비스 이용이 제한됩니다.
                        </div>
                    )}
                </div>

                <div className="flex flex-col gap-1 mt-1">
                    <div className="flex items-center gap-2">
                        <input type="checkbox" id="agreeMarketing" className="w-4 h-4 rounded border-zinc-300"
                            checked={agreements.marketing} onChange={handleAgreeChange('marketing')}
                        />
                        <label htmlFor="agreeMarketing" className="text-sm text-zinc-700 dark:text-zinc-300 cursor-pointer flex-1">
                            (선택) 마케팅 혜택 및 정보 수신 동의
                        </label>
                        <button type="button" onClick={() => setShowMarketing(!showMarketing)} className="text-[11px] text-zinc-500 underline underline-offset-2">
                            {showMarketing ? '접기' : '내용보기'}
                        </button>
                    </div>
                    {showMarketing && (
                        <div className="p-3 bg-zinc-50 dark:bg-zinc-900/50 rounded text-xs text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-800 mt-1">
                            <strong>수집 항목:</strong> 이름, 휴대폰 번호, 이메일<br/>
                            <strong>수집 목적:</strong> 신규 서비스 안내, 이벤트 등 마케팅 활용<br/>
                            <strong>보유 기간:</strong> 회원 탈퇴 또는 동의 철회 시까지<br/>
                            * 거부하시더라도 기본 서비스 이용에는 제한이 없습니다.
                        </div>
                    )}
                </div>
            </div>

            <button
                className="bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 font-semibold rounded-lg px-4 py-3 mt-4 transition-colors shadow-sm active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isVerifying}
            >
                {isVerifying ? '확인 중...' : '가입하기'}
            </button>
            <p className="text-sm text-center text-zinc-500 dark:text-zinc-400 mt-2 font-medium">
                이미 계정이 있으신가요? <Link href="/login" className="text-zinc-900 dark:text-zinc-100 hover:underline transition-all">로그인</Link>
            </p>
        </form>
    )
}
