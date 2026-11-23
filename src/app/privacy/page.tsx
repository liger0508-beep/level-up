import React from "react";

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 py-12 px-4 sm:px-6">
      <div className="max-w-3xl mx-auto bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 sm:p-10 shadow-sm space-y-6">
        <div className="border-b border-zinc-100 dark:border-zinc-800 pb-4">
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
            Level-Up 개인정보 처리방침 및 고객 지원
          </h1>
          <p className="text-xs text-zinc-400 mt-1">시행일자: 2026년 11월 1일</p>
        </div>

        <section className="space-y-2 text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">
          <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
            1. 수집하는 개인정보 항목
          </h2>
          <p>
            Level-Up(이하 &quot;서비스&quot;)은 골프 아카데미 레슨·스윙 분석·출석·스케쥴 관리 및 상담 서비스 제공을 위해 아래와 같은 최소한의 개인정보를 수집합니다.
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>필수 항목: 이름, 아이디(이메일), 비밀번호, 소속 지점, 회원 구분(선수/학부모/코치)</li>
            <li>선택 및 서비스 이용 과정에서 생성되는 항목: 레슨·분석 영상 및 사진, 스코어 기록, 스케쥴 예약 내역, 출석 QR 기록, 기기 푸시 알림 토큰</li>
          </ul>
        </section>

        <section className="space-y-2 text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">
          <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
            2. 개인정보의 이용 목적
          </h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>아카데미 회원 인증 및 맞춤형 레슨·스윙 분석·훈련 리포트 제공</li>
            <li>레슨·분석·상담 스케쥴 예약 관리 및 푸시 알림 발송</li>
            <li>출석 관리 및 학부모·코치 간 원활한 소통 지원</li>
          </ul>
        </section>

        <section className="space-y-2 text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">
          <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
            3. 기기 권한 접근 안내
          </h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>카메라 및 사진 보관함: 스윙 영상·분석 자료 촬영 및 업로드, 출석 QR 코드 스캔</li>
            <li>마이크: 스윙 영상 촬영 시 음성 녹음 및 음성 가이드</li>
            <li>알림: 레슨 및 스케쥴 예약, 공지사항 알림 수신</li>
          </ul>
        </section>

        <section className="space-y-2 text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">
          <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
            4. 보유 및 파기 (회원탈퇴)
          </h2>
          <p>
            회원은 언제든지 앱 및 웹 내 메뉴 하단의 <strong>&quot;회원탈퇴&quot;</strong> 버튼을 통해 직접 계정을 삭제할 수 있으며, 탈퇴 시 계정 정보는 지체 없이 파기됩니다.
          </p>
        </section>

        <section className="space-y-2 text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed pt-2 border-t border-zinc-100 dark:border-zinc-800">
          <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
            5. 고객 지원 및 문의
          </h2>
          <p>
            서비스 이용 문의, 계정 관련 지원 및 개인정보 보호 문의는 소속 지점 관리자 또는 아래 고객 지원 채널로 문의해 주시기 바랍니다.
          </p>
          <p className="font-medium text-zinc-900 dark:text-zinc-100">
            운영사: Level-Up (GLA Golf Academy)
          </p>
        </section>
      </div>
    </div>
  );
}
