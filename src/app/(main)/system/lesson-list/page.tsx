"use client";

import { useState, useEffect, Suspense } from "react";
import { Plus, Image as ImageIcon, Trash2, Edit2, Search, X, BookOpen, Upload, Loader2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { LessonTemplate, fetchLessonTemplates, saveLessonTemplate, deleteLessonTemplate } from "@/lib/lesson-template-sync";

export default function LessonListPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-zinc-400">로딩 중...</div>}>
            <LessonListContent />
        </Suspense>
    );
}

function LessonListContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const isSelectMode = searchParams.get("mode") === "select";

    const [templates, setTemplates] = useState<LessonTemplate[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editItem, setEditItem] = useState<LessonTemplate | null>(null);
    const [formData, setFormData] = useState({
        categoryId: "etc",
        title: "",
        description: "",
        imageUrl: ""
    });
    const [isSaving, setIsSaving] = useState(false);

    // Initial Load
    useEffect(() => {
        loadTemplates();
    }, []);

    async function loadTemplates() {
        setIsLoading(true);
        const data = await fetchLessonTemplates();
        setTemplates([...data].reverse());
        setIsLoading(false);
    }

    // Derived Data
    const filteredTemplates = templates.filter(t =>
        t.title.toLowerCase().includes(searchQuery.toLowerCase()) || t.description.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Handlers
    const handleOpenAddModal = () => {
        setEditItem(null);
        setFormData({
            categoryId: "etc",
            title: "",
            description: "",
            imageUrl: ""
        });
        setIsModalOpen(true);
    };

    const handleOpenEditModal = (template: LessonTemplate) => {
        setEditItem(template);
        setFormData({
            categoryId: template.categoryId,
            title: template.title,
            description: template.description,
            imageUrl: template.imageUrl
        });
        setIsModalOpen(true);
    };

    const handleDelete = async (id: string) => {
        if (confirm("해당 스윙 오류를 삭제하시겠습니까?")) {
            const { error } = await deleteLessonTemplate(id);
            if (error) {
                alert("삭제에 실패했습니다: " + error.message);
            } else {
                setTemplates(prev => prev.filter(t => t.id !== id));
            }
        }
    };

    const handleSave = async () => {
        if (!formData.title.trim()) {
            alert("제목을 입력해주세요.");
            return;
        }

        setIsSaving(true);
        const { data, error } = await saveLessonTemplate({
            id: editItem?.id,
            categoryId: formData.categoryId,
            title: formData.title,
            description: formData.description,
            imageUrl: formData.imageUrl
        });

        if (error) {
            alert("저장에 실패했습니다: " + error.message);
        } else {
            if (editItem) {
                setTemplates(prev => prev.map(t => t.id === editItem.id ? data : t));
            } else {
                setTemplates(prev => [data, ...prev]);
            }
            setIsModalOpen(false);
        }
        setIsSaving(false);
    };

    const handleSelectTemplate = (template: LessonTemplate) => {
        if (confirm(`'${template.title}' 스윙 오류를 배정하시겠습니까?`)) {
            const resumeEditId = searchParams.get("resumeEdit");
            const DRAFT_KEY = resumeEditId ? `lesson_edit_draft_${resumeEditId}` : "lesson_create_draft";
            try {
                const draftStr = sessionStorage.getItem(DRAFT_KEY);
                const draft = draftStr ? JSON.parse(draftStr) : {};
                
                if (!draft.selectedImages) draft.selectedImages = [];
                
                if (!draft.selectedImages.includes(template.id)) {
                    draft.selectedImages.push(template.id);
                    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
                }
                
                if (resumeEditId) {
                    router.push(`/lessons/${resumeEditId}/edit?resumeEdit=true&ts=${Date.now()}#swing-error-section`);
                } else {
                    router.push(`/lessons/create?ts=${Date.now()}#swing-error-section`);
                }
            } catch (e) {
                console.error("Failed to save to draft", e);
                alert("배정 중 오류가 발생했습니다.");
            }
        }
    };

    return (
        <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 pb-24">
            <main className="max-w-6xl mx-auto px-4 sm:px-8 py-10">
                {/* Header */}
                <div className="mb-8">
                    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                        <div>
                            <div className="flex items-center gap-2 mb-2">
                                <BookOpen size={24} className="text-brand-navy dark:text-brand-navy-light shrink-0" />
                                <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50 tracking-tight">
                                    {isSelectMode ? "스윙 오류 배정" : "스윙 오류 관리"}
                                </h1>
                            </div>
                            <p className="text-sm text-zinc-500 dark:text-zinc-400">
                                {isSelectMode 
                                    ? "레슨 작성에 배정할 스윙 오류 항목을 선택해주세요."
                                    : "레슨 작성 시 선택할 수 있는 스윙 오류(이미지 및 설명) 리스트를 관리합니다."}
                            </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                            {isSelectMode && (
                                <button
                                    onClick={() => {
                                        const resumeEditId = searchParams.get("resumeEdit");
                                        if (resumeEditId) {
                                            router.push(`/lessons/${resumeEditId}/edit?resumeEdit=true&ts=${Date.now()}#swing-error-section`);
                                        } else {
                                            router.push(`/lessons/create?ts=${Date.now()}#swing-error-section`);
                                        }
                                    }}
                                    className="flex items-center justify-center gap-2 px-4 py-2.5 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-700 text-sm font-bold rounded-xl transition-colors shadow-sm shrink-0 whitespace-nowrap"
                                >
                                    뒤로 가기
                                </button>
                            )}
                            {!isSelectMode && (
                                <button
                                    onClick={handleOpenAddModal}
                                    className="flex items-center justify-center gap-2 px-5 py-2.5 bg-brand-navy hover:bg-brand-navy-light text-white text-sm font-bold rounded-xl transition-colors shadow-sm shrink-0 whitespace-nowrap"
                                >
                                    <Plus size={16} />
                                    항목 추가
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Sub Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
                    <h2 className="text-base font-bold text-zinc-800 dark:text-zinc-200">
                        전체 항목 ({filteredTemplates.length})
                    </h2>
                    <div className="relative w-full sm:w-72">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
                        <input
                            type="text"
                            placeholder="제목 또는 설명 검색"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 text-sm rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 focus:ring-2 focus:ring-brand-navy/40 outline-none transition-all"
                        />
                    </div>
                </div>

                {/* List */}
                <div className="space-y-3">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center p-20">
                            <Loader2 className="animate-spin text-brand-navy mb-4" size={32} />
                            <p className="text-zinc-500 font-medium">데이터를 불러오는 중입니다...</p>
                        </div>
                    ) : filteredTemplates.length > 0 ? (
                        filteredTemplates.map(template => (
                            <div key={template.id} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow group flex items-stretch">
                                {/* Square Image / Category Icon */}
                                <div className="relative w-24 h-24 sm:w-28 sm:h-28 overflow-hidden shrink-0 rounded-l-2xl">
                                    {template.imageUrl ? (
                                        <img src={template.imageUrl} alt={template.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center bg-zinc-100 dark:bg-zinc-800">
                                            <ImageIcon size={32} className="text-zinc-300 dark:text-zinc-600" />
                                        </div>
                                    )}
                                </div>

                                {/* Content */}
                                <div className="flex-1 p-3 sm:p-4 flex flex-col justify-center min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <h3 className="font-bold text-sm sm:text-base text-zinc-900 dark:text-zinc-100 truncate">{template.title}</h3>
                                    </div>
                                    <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 line-clamp-2 leading-relaxed">
                                        {template.description || "설명이 없습니다."}
                                    </p>
                                </div>

                                {/* Actions */}
                                <div className={`flex items-center gap-1 pr-3 sm:pr-4 shrink-0 transition-opacity ${isSelectMode ? "opacity-100" : "opacity-100 sm:opacity-0 sm:group-hover:opacity-100"}`}>
                                    {isSelectMode ? (
                                        <button
                                            onClick={() => handleSelectTemplate(template)}
                                            className="px-4 py-2 bg-brand-navy hover:bg-brand-navy-light text-white text-sm font-bold rounded-lg transition-colors shadow-sm"
                                        >
                                            배정
                                        </button>
                                    ) : (
                                        <>
                                            <button
                                                onClick={() => handleOpenEditModal(template)}
                                                className="p-2 hover:bg-brand-navy/10 hover:text-brand-navy text-zinc-400 rounded-lg transition-colors"
                                            >
                                                <Edit2 size={15} />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(template.id)}
                                                className="p-2 hover:bg-red-50 hover:text-red-500 text-zinc-400 rounded-lg transition-colors"
                                            >
                                                <Trash2 size={15} />
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="flex flex-col items-center justify-center p-12 bg-white dark:bg-zinc-900 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl">
                            <ImageIcon size={48} className="text-zinc-300 mb-4" />
                            <h3 className="text-lg font-bold text-zinc-700 dark:text-zinc-300 mb-1">검색된 항목이 없습니다</h3>
                            <p className="text-sm text-zinc-500 text-center">우측 상단의 버튼을 눌러 새로운 레슨 항목을 추가해보세요.</p>
                        </div>
                    )}
                </div>
            </main>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl w-full max-w-lg border border-zinc-200 dark:border-zinc-800 overflow-hidden flex flex-col max-h-[90vh]">
                        {/* Header */}
                        <div className="p-5 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center bg-zinc-50 dark:bg-zinc-900/50 shrink-0">
                            <h2 className="font-bold text-lg text-zinc-900 dark:text-zinc-100">
                                {editItem ? "항목 수정" : "새 항목 추가"}
                            </h2>
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="p-1.5 text-zinc-400 hover:text-zinc-900 bg-white rounded-lg border border-zinc-200"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Body */}
                        <div className="p-6 space-y-5 overflow-y-auto">


                            <div>
                                <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">항목 이름</label>
                                <input
                                    type="text"
                                    value={formData.title}
                                    onChange={e => setFormData({ ...formData, title: e.target.value })}
                                    placeholder="예) 치킨윙, 오버더탑"
                                    className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-sm focus:outline-none focus:ring-2 focus:ring-brand-navy/40 transition-all"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">이미지</label>
                                {formData.imageUrl ? (
                                    <div className="relative rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800">
                                        <img src={formData.imageUrl} alt="미리보기" className="w-full h-48 object-cover" />
                                        <button
                                            type="button"
                                            onClick={() => setFormData({ ...formData, imageUrl: "" })}
                                            className="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-black/80 text-white rounded-lg transition-colors"
                                        >
                                            <X size={16} />
                                        </button>
                                    </div>
                                ) : (
                                    <label className="flex flex-col items-center justify-center w-full h-40 rounded-xl border-2 border-dashed border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 hover:border-brand-navy/50 hover:bg-brand-navy/5 cursor-pointer transition-all">
                                        <Upload size={28} className="text-zinc-400 mb-2" />
                                        <span className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">클릭하여 이미지 업로드</span>
                                        <span className="text-xs text-zinc-400 mt-1">JPG, PNG, GIF (최대 5MB)</span>
                                        <input
                                            type="file"
                                            accept="image/*"
                                            className="hidden"
                                            onChange={(e) => {
                                                const file = e.target.files?.[0];
                                                if (!file) return;
                                                if (file.size > 5 * 1024 * 1024) {
                                                    alert("파일 크기는 5MB 이하만 가능합니다.");
                                                    return;
                                                }
                                                const reader = new FileReader();
                                                reader.onloadend = () => {
                                                    setFormData({ ...formData, imageUrl: reader.result as string });
                                                };
                                                reader.readAsDataURL(file);
                                            }}
                                        />
                                    </label>
                                )}
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">간단한 설명 (코멘트)</label>
                                <textarea
                                    value={formData.description}
                                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                                    placeholder="어떤 항목인지 간단한 설명을 적어두세요."
                                    rows={4}
                                    className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-sm focus:outline-none focus:ring-2 focus:ring-brand-navy/40 transition-all resize-none leading-relaxed"
                                />
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="p-5 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 shrink-0 flex gap-3 justify-end">
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="px-5 py-2.5 rounded-xl text-sm font-bold text-zinc-600 bg-white border border-zinc-200 hover:bg-zinc-50 transition-colors"
                                disabled={isSaving}
                            >
                                취소
                            </button>
                            <button
                                onClick={handleSave}
                                className="px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-brand-navy hover:bg-brand-navy-light transition-colors flex items-center gap-2"
                                disabled={isSaving}
                            >
                                {isSaving && <Loader2 className="animate-spin" size={14} />}
                                {editItem ? "수정 완료" : "저장하기"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
