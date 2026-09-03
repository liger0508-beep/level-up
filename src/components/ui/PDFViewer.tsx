'use client';
import { useState, useRef, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Set up the worker for PDF.js
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PDFViewerProps {
    file: File | string;
    className?: string;
}

export default function PDFViewer({ file, className }: PDFViewerProps) {
    const [numPages, setNumPages] = useState<number>();
    const [pageNumber, setPageNumber] = useState<number>(1);
    
    const containerRef = useRef<HTMLDivElement>(null);
    const [containerWidth, setContainerWidth] = useState<number>(0);

    useEffect(() => {
        if (!containerRef.current) return;
        let timeoutId: any;
        const observer = new ResizeObserver((entries) => {
            const width = entries[0].contentRect.width;
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => {
                setContainerWidth(width);
            }, 150);
        });
        observer.observe(containerRef.current);
        return () => observer.disconnect();
    }, []);

    function onDocumentLoadSuccess({ numPages }: { numPages: number }): void {
        setNumPages(numPages);
        setPageNumber(1);
    }

    const prevPage = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setPageNumber(prev => Math.max(prev - 1, 1));
    };

    const nextPage = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setPageNumber(prev => Math.min(prev + 1, numPages || 1));
    };

    // Touch swipe logic for mobile
    const touchStartX = useRef<number>(0);
    const handleTouchStart = (e: React.TouchEvent) => {
        touchStartX.current = e.touches[0].clientX;
    };
    const handleTouchEnd = (e: React.TouchEvent) => {
        const dx = e.changedTouches[0].clientX - touchStartX.current;
        if (Math.abs(dx) > 50) { // minimum swipe distance
            if (dx < 0 && pageNumber < (numPages || 1)) {
                // Swipe Left -> Next Page
                setPageNumber(prev => prev + 1);
            } else if (dx > 0 && pageNumber > 1) {
                // Swipe Right -> Prev Page
                setPageNumber(prev => prev - 1);
            }
        }
    };

    return (
        <div 
            className={`relative flex flex-col w-full h-full bg-zinc-100 dark:bg-zinc-900 group ${className || ''}`}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
        >
            <div ref={containerRef} className="relative flex-1 w-full h-full bg-transparent flex items-center justify-center">
                <Document
                    file={file}
                    onLoadSuccess={onDocumentLoadSuccess}
                    className="w-full h-full flex items-center justify-center"
                    loading={<div className="text-sm text-zinc-500 font-medium">PDF 불러오는 중...</div>}
                    error={<div className="text-sm text-red-500 font-medium">PDF를 불러오지 못했습니다.</div>}
                >
                    {containerWidth > 0 && (
                        <Page 
                            pageNumber={pageNumber} 
                            renderTextLayer={false}
                            renderAnnotationLayer={false}
                            className="flex items-center justify-center !w-full !h-full [&>.react-pdf__Page__canvas]:!max-w-full [&>.react-pdf__Page__canvas]:!max-h-full [&>.react-pdf__Page__canvas]:!w-auto [&>.react-pdf__Page__canvas]:!h-auto [&>.react-pdf__Page__canvas]:!object-contain shadow-sm"
                            width={containerWidth}
                        />
                    )}
                </Document>
            </div>
            {numPages && numPages > 1 && (
                <>
                    <div className="absolute -top-1 sm:-top-5 right-1 sm:-right-1 h-7 flex items-center justify-center bg-black/60 backdrop-blur-sm text-white text-[11px] font-semibold px-3 rounded-full z-30 pointer-events-none tracking-widest">
                        {pageNumber} / {numPages}
                    </div>
                    <button type="button" onClick={prevPage} disabled={pageNumber <= 1} className="hidden sm:flex absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/80 dark:bg-black/60 backdrop-blur-sm hover:bg-white dark:hover:bg-black text-zinc-800 dark:text-zinc-200 rounded-full items-center justify-center shadow-lg transition-all opacity-0 group-hover:opacity-100 disabled:opacity-0 z-30">
                        <ChevronLeft size={24} />
                    </button>
                    <button type="button" onClick={nextPage} disabled={pageNumber >= numPages} className="hidden sm:flex absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/80 dark:bg-black/60 backdrop-blur-sm hover:bg-white dark:hover:bg-black text-zinc-800 dark:text-zinc-200 rounded-full items-center justify-center shadow-lg transition-all opacity-0 group-hover:opacity-100 disabled:opacity-0 z-30">
                        <ChevronRight size={24} />
                    </button>
                </>
            )}
        </div>
    );
}
