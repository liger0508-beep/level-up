"use client";

import React, { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";

export default function AnimationPreview() {
  const [mounted, setMounted] = useState(false);
  
  // 컴포넌트가 로드되면 애니메이션 시작
  useEffect(() => {
    // 0.1초 뒤에 애니메이션 시작 (자연스러운 시작을 위해)
    const timer = setTimeout(() => setMounted(true), 100);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="fixed inset-0 bg-[#00214d] flex items-center justify-center overflow-hidden">
      <div className="relative flex items-center justify-center w-full h-[300px]">
        
        <div className="relative flex items-end pb-4">
          {/* 메인 텍스트 애니메이션 (제자리에서 페이드 인) */}
          <h1 
            className={`relative z-10 text-white text-[2.8rem] sm:text-[3.5rem] font-black italic tracking-wider leading-none transition-opacity duration-[1000ms] delay-100 ease-in-out ${
              mounted ? "opacity-100" : "opacity-0"
            }`}
            style={{ textShadow: "0 4px 15px rgba(0,0,0,0.5)" }}
          >
            GLA Level-Up
          </h1>
          
          {/* 화살표 애니메이션 (시작점을 p의 아랫부분에 맞춤) */}
          <div 
            className={`text-brand-red ml-0 z-20 transition-all duration-[800ms] delay-[1100ms] ease-[cubic-bezier(0.34,1.56,0.64,1)] ${
              mounted 
                  ? "translate-x-[10px] translate-y-[-5px] opacity-100 scale-100 rotate-45" 
                  : "translate-x-[-15px] translate-y-[20px] opacity-0 scale-50 rotate-45"
            }`}
          >
            <ArrowUp size={48} strokeWidth={5} />
          </div>
        </div>
      </div>
      
      {/* 다시보기 버튼 (테스트용) */}
      <button 
        onClick={() => { 
            setMounted(false); 
            setTimeout(() => setMounted(true), 100); 
        }}
        className="absolute bottom-10 px-5 py-2.5 bg-white/10 text-white rounded-full text-sm font-bold hover:bg-white/20 transition-colors backdrop-blur-sm"
      >
        🔄 애니메이션 다시 보기
      </button>
    </div>
  );
}
