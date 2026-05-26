"use client";

import { useState, useEffect } from "react";
import { Plus, Image as ImageIcon, Trash2, Edit2, Search, X, Trophy, Upload, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import { fetchChallengeTemplates, saveChallengeTemplate, deleteChallengeTemplate, ChallengeTemplate } from "@/lib/challenge-template-sync";
import { uploadFile } from "@/lib/storage-sync";

// ── Category visual config ──
const categoryStyle: Record<string, { gradient: string; label: string }> = {
    shot: { gradient: "from-amber-400 to-orange-600", label: "샷" },
    short_game: { gradient: "from-emerald-400 to-teal-600", label: "숏게임" },
    putting: { gradient: "from-violet-400 to-fuchsia-600", label: "퍼팅" },
    physical: { gradient: "from-sky-400 to-indigo-600", label: "피지컬" },
    etc: { gradient: "from-zinc-400 to-slate-600", label: "기타" },
};

function CategoryIcon({ categoryId }: { categoryId: string }) {
    const style = categoryStyle[categoryId] || categoryStyle.etc;

    return (
        <div className={`w-full h-full flex items-center justify-center bg-gradient-to-br ${style.gradient} relative overflow-hidden`}>
            <span
                className="text-white/20 font-black text-[40px] sm:text-[52px] leading-none select-none absolute"
                style={{ transform: "rotate(-18deg) translate(-2px, 4px)", fontStyle: "italic", letterSpacing: "-3px" }}
            >
                {style.label}
            </span>
            <span
                className="text-white font-black text-base sm:text-lg leading-none select-none relative z-10 drop-shadow-lg tracking-tight"
                style={{ fontStyle: "italic" }}
            >
                {style.label}
            </span>
        </div>
    );
}

// ── Types ──
interface ChallengeCategory {
    id: string;
    name: string;
}

const categories: ChallengeCategory[] = [
    { id: "all", name: "전체" },
    { id: "shot", name: "샷" },
    { id: "short_game", name: "숏게임" },
    { id: "putting", name: "퍼팅" },
    { id: "physical", name: "피지컬" },
    { id: "etc", name: "기타" },
];

export default function ChallengeListPage() {
    const [activeTab, setActiveTab] = useState<string>("all");
    const [templates, setTemplates] = useState<ChallengeTemplate[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const loadTemplates = async () => {
            setIsLoading(true);
            const data = await fetchChallengeTemplates();
            setTemplates(data);
            setIsLoading(false);
        };
        loadTemplates();
    }, []);

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editItem, setEditItem] = useState<ChallengeTemplate | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [formData, setFormData] = useState({
        categoryId: categories[1].id,
        title: "",
        description: "",
        purpose: "",
        goal: "",
        mediaUrl: "",
        mediaType: "",
        sort_order: 0
    });

    // Derived Data
    const filteredTemplates = templates.filter(t =>
        (activeTab === "all" || t.categoryId === activeTab) &&
        (t.title.toLowerCase().includes(searchQuery.toLowerCase()) || t.description.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    // Categories for modal (exclude "all")
    const editableCategories = categories.filter(c => c.id !== "all");

    // Handlers
    const handleOpenAddModal = () => {
        setEditItem(null);
        setSelectedFile(null);
        setFormData({
            categoryId: activeTab === "all" ? "shot" : activeTab,
            title: "",
            description: "",
            purpose: "",
            goal: "",
            mediaUrl: "",
            mediaType: "",
            sort_order: templates.length + 1
        });
        setIsModalOpen(true);
    };

    const handleOpenEditModal = (template: ChallengeTemplate) => {
        setEditItem(template);
        setSelectedFile(null);
        setFormData({
            categoryId: template.categoryId,
            title: template.title,
            description: template.description || "",
            purpose: template.purpose || "",
            goal: template.goal || "",
            mediaUrl: template.mediaUrl || "",
            mediaType: template.mediaType || "",
            sort_order: template.sort_order || 0
        });
        setIsModalOpen(true);
    };

    const handleDelete = async (id: string) => {
        if (confirm("해당 챌린지 컨텐츠를 삭제하시겠습니까?")) {
            const { error } = await deleteChallengeTemplate(id);
            if (!error) {
                setTemplates(templates.filter(t => t.id !== id));
            } else {
                alert("삭제에 실패했습니다.");
            }
        }
    };

    const handleSave = async () => {
        if (!formData.title.trim()) {
            alert("제목을 입력해주세요.");
            return;
        }

        setIsSaving(true);
        try {
            let finalMediaUrl = formData.mediaUrl;
            let finalMediaType = formData.mediaType;

            if (selectedFile) {
                finalMediaUrl = await uploadFile(selectedFile, 'records', `templates/challenges/${Date.now()}_${selectedFile.name}`);
                finalMediaType = selectedFile.type;
            }

            const newTemplate = {
                categoryId: formData.categoryId,
                title: formData.title,
                description: formData.description,
                purpose: formData.purpose,
                goal: formData.goal,
                mediaUrl: finalMediaUrl,
                mediaType: finalMediaType,
                sort_order: formData.sort_order,
            };

            const payload = editItem ? { ...newTemplate, id: editItem.id } : newTemplate;
            const { data, error } = await saveChallengeTemplate(payload);

            if (error) throw error;

            if (editItem) {
                setTemplates(templates.map(t => t.id === editItem.id ? data : t));
            } else {
                setTemplates([...templates, data].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)));
            }

            setIsModalOpen(false);
        } catch (error) {
            console.error("Failed to save challenge template:", error);
            alert("항목 저장에 실패했습니다.");
        } finally {
            setIsSaving(false);
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
                                <Trophy size={24} className="text-amber-500 shrink-0" />
                                <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50 tracking-tight">
                                    챌린지 컨텐츠 관리
                                </h1>
                            </div>
                            <p className="text-sm text-zinc-500 dark:text-zinc-400">
                                선수들이 참여하고 경쟁할 수 있는 <b>챌린지 컨텐츠</b>를 등록하고 관리합니다.
                            </p>
                        </div>
                        <button
                            onClick={handleOpenAddModal}
                            className="flex items-center justify-center gap-2 px-5 py-2.5 bg-brand-navy hover:bg-brand-navy-light text-white text-sm font-bold rounded-xl transition-colors shadow-sm shrink-0 whitespace-nowrap"
                        >
                            <Plus size={16} />
                            컨텐츠 추가
                        </button>
                    </div>
                </div>

                {/* Categories Tabs */}
                <div className="mb-6">
                    <div className="flex space-x-1.5 sm:space-x-2 overflow-x-auto pb-2 scrollbar-hide">
                        {categories.map(category => (
                            <button
                                key={category.id}
                                onClick={() => setActiveTab(category.id)}
                                className={cn(
                                    "px-3 sm:px-5 py-2 sm:py-2.5 rounded-full text-xs sm:text-sm font-bold whitespace-nowrap transition-all",
                                    activeTab === category.id
                                        ? "bg-brand-navy text-white shadow-md shadow-brand-navy/20"
                                        : "bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-800 hover:border-brand-navy/50 hover:text-brand-navy"
                                )}
                            >
                                {category.name}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Sub Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
                    <h2 className="text-base font-bold text-zinc-800 dark:text-zinc-200">
                        {activeTab === "all" ? "전체" : categories.find(c => c.id === activeTab)?.name} 컨텐츠 ({filteredTemplates.length})
                    </h2>
                    <div className="relative w-full sm:w-72">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
                        <input
                            type="text"
                            placeholder="컨텐츠명 또는 설명 검색"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 text-sm rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 focus:ring-2 focus:ring-brand-navy/40 outline-none transition-all"
                        />
                    </div>
                </div>

                {/* List */}
                <div className="space-y-3">
                    {filteredTemplates.map((template, idx) => (
                        <div key={template.id} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow group flex items-stretch">
                            {/* Square Image / Category Icon */}
                            <div className="relative w-24 h-24 sm:w-28 sm:h-28 overflow-hidden shrink-0 rounded-l-2xl">
                                {template.mediaUrl ? (
                                    template.mediaType?.startsWith('video/') ? (
                                        <video src={template.mediaUrl} className="w-full h-full object-cover" muted />
                                    ) : (
                                        <img src={template.mediaUrl} alt={template.title} className="w-full h-full object-cover" />
                                    )
                                ) : (
                                    <CategoryIcon categoryId={template.categoryId} />
                                )}
                            </div>

                            {/* Content */}
                            <div className="flex-1 p-3 sm:p-4 flex flex-col justify-center min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="text-[10px] text-amber-600 dark:text-amber-400 font-black px-1.5 py-0.5 bg-amber-50 dark:bg-amber-500/10 rounded">
                                        #{idx + 1}
                                    </span>
                                    <h3 className="font-bold text-sm sm:text-base text-zinc-900 dark:text-zinc-100 truncate">{template.title}</h3>
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 font-semibold whitespace-nowrap shrink-0">
                                        {categories.find(c => c.id === template.categoryId)?.name || template.categoryId}
                                    </span>
                                </div>
                                <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 line-clamp-2 leading-relaxed">
                                    {template.description || "설명이 없습니다."}
                                </p>
                                {(template.purpose || template.goal) && (
                                    <div className="flex items-center gap-3 mt-1.5">
                                        {template.purpose && (
                                            <span className="text-[10px] text-zinc-400 truncate max-w-[200px]">
                                                🎯 {template.purpose}
                                            </span>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-1 pr-3 sm:pr-4 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
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
                            </div>
                        </div>
                    ))}
                </div>

                {isLoading ? (
                    <div className="flex justify-center items-center py-20">
                        <div className="animate-spin w-8 h-8 border-4 border-brand-navy border-t-transparent rounded-full"></div>
                    </div>
                ) : filteredTemplates.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-12 bg-white dark:bg-zinc-900 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl">
                        <Trophy size={48} className="text-zinc-300 mb-4" />
                        <h3 className="text-lg font-bold text-zinc-700 dark:text-zinc-300 mb-1">등록된 챌린지 컨텐츠가 없습니다</h3>
                        <p className="text-sm text-zinc-500 text-center">우측 상단의 버튼을 눌러 새로운 챌린지 컨텐츠를 추가해보세요.</p>
                    </div>
                ) : null}
            </main>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl w-full max-w-lg border border-zinc-200 dark:border-zinc-800 overflow-hidden flex flex-col max-h-[90vh]">
                        {/* Header */}
                        <div className="p-5 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center bg-zinc-50 dark:bg-zinc-900/50 shrink-0">
                            <h2 className="font-bold text-lg text-zinc-900 dark:text-zinc-100">
                                {editItem ? "챌린지 컨텐츠 수정" : "새 챌린지 컨텐츠 추가"}
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
                                <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">카테고리</label>
                                <select
                                    value={formData.categoryId}
                                    onChange={e => setFormData({ ...formData, categoryId: e.target.value })}
                                    className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-sm focus:outline-none focus:ring-2 focus:ring-brand-navy/40 transition-all font-medium appearance-none"
                                >
                                    {editableCategories.map(c => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">챌린지 컨텐츠명</label>
                                <input
                                    type="text"
                                    value={formData.title}
                                    onChange={e => setFormData({ ...formData, title: e.target.value })}
                                    placeholder="예) 드라이버 비거리 챌린지, 벙커 탈출 챌린지"
                                    className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-sm focus:outline-none focus:ring-2 focus:ring-brand-navy/40 transition-all"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">미디어 (이미지/동영상)</label>
                                {formData.mediaUrl ? (
                                    <div className="relative rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800">
                                        {formData.mediaType?.startsWith('video/') ? (
                                            <video src={formData.mediaUrl} controls className="w-full h-48 object-cover" />
                                        ) : (
                                            <img src={formData.mediaUrl} alt="미리보기" className="w-full h-48 object-cover" />
                                        )}
                                        <button
                                            type="button"
                                            onClick={() => { setFormData({ ...formData, mediaUrl: "", mediaType: "" }); setSelectedFile(null); }}
                                            className="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-black/80 text-white rounded-lg transition-colors z-10"
                                        >
                                            <X size={16} />
                                        </button>
                                    </div>
                                ) : (
                                    <label className="flex flex-col items-center justify-center w-full h-40 rounded-xl border-2 border-dashed border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 hover:border-brand-navy/50 hover:bg-brand-navy/5 cursor-pointer transition-all">
                                        <Upload size={28} className="text-zinc-400 mb-2" />
                                        <span className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">클릭하여 미디어 업로드</span>
                                        <span className="text-xs text-zinc-400 mt-1">이미지 및 동영상 (최대 50MB)</span>
                                        <input
                                            type="file"
                                            accept="image/*,video/*"
                                            className="hidden"
                                            onChange={(e) => {
                                                const file = e.target.files?.[0];
                                                if (!file) return;
                                                if (file.size > 50 * 1024 * 1024) {
                                                    alert("파일 크기는 50MB 이하만 가능합니다.");
                                                    return;
                                                }
                                                const reader = new FileReader();
                                                reader.onloadend = () => {
                                                    setFormData({ ...formData, mediaUrl: reader.result as string, mediaType: file.type });
                                                    setSelectedFile(file);
                                                };
                                                reader.readAsDataURL(file);
                                            }}
                                        />
                                    </label>
                                )}
                                <p className="text-[11px] text-zinc-400 mt-1.5">미디어가 없으면 카테고리 아이콘이 자동으로 표시됩니다.</p>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">챌린지 목적</label>
                                <textarea
                                    value={formData.purpose}
                                    onChange={e => setFormData({ ...formData, purpose: e.target.value })}
                                    placeholder="예) 샷 능력의 종합적인 평가 및 경쟁"
                                    rows={2}
                                    className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-sm focus:outline-none focus:ring-2 focus:ring-brand-navy/40 transition-all resize-none leading-relaxed"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">챌린지 목표</label>
                                <textarea
                                    value={formData.goal}
                                    onChange={e => setFormData({ ...formData, goal: e.target.value })}
                                    placeholder="예) 드라이버 10구 + 아이언 거리별 4구씩 기록 후 종합점수 산출"
                                    rows={2}
                                    className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-sm focus:outline-none focus:ring-2 focus:ring-brand-navy/40 transition-all resize-none leading-relaxed"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">챌린지 상세 설명</label>
                                <textarea
                                    value={formData.description}
                                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                                    placeholder="챌린지의 진행 방법과 규칙을 입력하세요."
                                    rows={4}
                                    className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-sm focus:outline-none focus:ring-2 focus:ring-brand-navy/40 transition-all resize-none leading-relaxed"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">정렬 순서</label>
                                <input
                                    type="number"
                                    min={0}
                                    value={formData.sort_order}
                                    onChange={e => setFormData({ ...formData, sort_order: parseInt(e.target.value) || 0 })}
                                    className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-sm focus:outline-none focus:ring-2 focus:ring-brand-navy/40 transition-all"
                                />
                                <p className="text-[11px] text-zinc-400 mt-1">숫자가 낮을수록 먼저 표시됩니다.</p>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="p-5 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 shrink-0 flex gap-3 justify-end">
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="px-5 py-2.5 rounded-xl text-sm font-bold text-zinc-600 bg-white border border-zinc-200 hover:bg-zinc-50 transition-colors"
                            >
                                취소
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={isSaving}
                                className="px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-brand-navy hover:bg-brand-navy-light transition-colors disabled:opacity-50"
                            >
                                {isSaving ? "저장 중..." : "저장하기"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
