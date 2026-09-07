"use client";

import React, { useRef, useState, useEffect } from 'react';
import { RefreshCcw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SignaturePadProps {
    onSave: (signatureDataUrl: string) => void;
    title: string;
    description?: string;
    buttonText?: string;
    onCancel?: () => void;
}

export function SignaturePad({ onSave, title, description, buttonText = "서명 완료", onCancel }: SignaturePadProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [hasDrawn, setHasDrawn] = useState(false);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        // 고해상도 디스플레이 지원
        const rect = canvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.scale(dpr, dpr);
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.strokeStyle = '#000000'; // dark mode에서도 잘 보이게 기본 검정색 펜, 캔버스는 흰색 배경
            ctx.lineWidth = 3;
            // 흰색 배경으로 채우기
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, rect.width, rect.height);
        }
    }, []);

    const getCoordinates = (e: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent) => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        
        const rect = canvas.getBoundingClientRect();
        
        if ('touches' in e) {
            return {
                x: e.touches[0].clientX - rect.left,
                y: e.touches[0].clientY - rect.top
            };
        }
        
        return {
            x: (e as React.MouseEvent).clientX - rect.left,
            y: (e as React.MouseEvent).clientY - rect.top
        };
    };

    const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
        e.preventDefault();
        const { x, y } = getCoordinates(e);
        const ctx = canvasRef.current?.getContext('2d');
        if (ctx) {
            ctx.beginPath();
            ctx.moveTo(x, y);
            setIsDrawing(true);
        }
    };

    const draw = (e: React.MouseEvent | React.TouchEvent) => {
        e.preventDefault();
        if (!isDrawing) return;
        
        const { x, y } = getCoordinates(e);
        const ctx = canvasRef.current?.getContext('2d');
        if (ctx) {
            ctx.lineTo(x, y);
            ctx.stroke();
            if (!hasDrawn) setHasDrawn(true);
        }
    };

    const stopDrawing = () => {
        const ctx = canvasRef.current?.getContext('2d');
        if (ctx) {
            ctx.closePath();
            setIsDrawing(false);
        }
    };

    const clearCanvas = () => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (canvas && ctx) {
            const rect = canvas.getBoundingClientRect();
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, rect.width, rect.height);
            setHasDrawn(false);
        }
    };

    const handleSave = () => {
        if (!hasDrawn || !canvasRef.current) return;
        const dataUrl = canvasRef.current.toDataURL('image/png');
        onSave(dataUrl);
    };

    return (
        <div className="w-full">
            <div className="mb-4 text-center">
                <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">{title}</h3>
                {description && <p className="text-sm text-zinc-500 mt-1">{description}</p>}
            </div>

            <div className="relative border-2 border-zinc-200 dark:border-zinc-700 rounded-2xl overflow-hidden bg-white touch-none">
                <canvas
                    ref={canvasRef}
                    className="w-full h-48 sm:h-64 cursor-crosshair"
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={draw}
                    onTouchEnd={stopDrawing}
                />
                
                {!hasDrawn && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <span className="text-zinc-300 text-2xl font-semibold select-none">여기에 서명하세요</span>
                    </div>
                )}
                
                <button
                    type="button"
                    onClick={clearCanvas}
                    className="absolute top-3 right-3 p-2 bg-zinc-100/80 hover:bg-zinc-200 text-zinc-600 rounded-full transition-colors backdrop-blur-sm"
                    title="지우기"
                >
                    <RefreshCcw size={18} />
                </button>
            </div>

            <div className="flex gap-3 mt-6">
                {onCancel && (
                    <button
                        type="button"
                        onClick={onCancel}
                        className="flex-1 px-4 py-3.5 rounded-xl border border-zinc-200 dark:border-zinc-700 font-bold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                    >
                        취소
                    </button>
                )}
                <button
                    type="button"
                    onClick={handleSave}
                    disabled={!hasDrawn}
                    className={cn(
                        "flex-1 px-4 py-3.5 rounded-xl font-bold transition-all shadow-sm",
                        hasDrawn 
                            ? "bg-brand-navy hover:bg-brand-navy-dark text-white active:scale-[0.98]" 
                            : "bg-zinc-100 dark:bg-zinc-800 text-zinc-400 cursor-not-allowed"
                    )}
                >
                    {buttonText}
                </button>
            </div>
        </div>
    );
}
