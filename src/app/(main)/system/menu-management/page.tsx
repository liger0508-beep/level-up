"use client";

import { useState } from "react";
import {
    Menu,
    Plus,
    Trash2,
    Edit2,
    GripVertical,
    ChevronDown,
    ChevronUp,
    X,
    Save,
    Settings2,
    Tag,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ──
interface CategoryItem {
    id: string;
    key: string;
    label: string;
}

interface MenuItem {
    id: string;
    title: string;
    href: string;
    enabled: boolean;
    categories: CategoryItem[];
}

// ── Initial Mock Data (mirrors the actual sidebar & app categories) ──
const initialMenus: MenuItem[] = [
    {
        id: "m1",
        title: "대시보드",
        href: "/dashboard",
        enabled: true,
        categories: [],
    },
    {
        id: "m2",
        title: "스케줄",
        href: "/schedule",
        enabled: true,
        categories: [],
    },

    {
        id: "m4",
        title: "레슨",
        href: "/lessons",
        enabled: true,
        categories: [
            { id: "c4", key: "shot", label: "Shot" },
            { id: "c15", key: "pitch", label: "Pitch" },
            { id: "c16", key: "bunker", label: "Bunker" },
            { id: "c17", key: "approach", label: "Approach" },
            { id: "c5", key: "putt", label: "Putt" },
            { id: "c6", key: "physical", label: "Physical" },
            { id: "c18", key: "etc", label: "Etc" },
            { id: "c7", key: "field", label: "Field" },
        ],
    },
    {
        id: "m5",
        title: "스코어",
        href: "/scores",
        enabled: true,
        categories: [],
    },
    {
        id: "m6",
        title: "훈련",
        href: "/training",
        enabled: true,
        categories: [
            { id: "c8", key: "shot", label: "Shot" },
            { id: "c19", key: "pitch", label: "Pitch" },
            { id: "c20", key: "bunker", label: "Bunker" },
            { id: "c21", key: "approach", label: "Approach" },
            { id: "c9", key: "putt", label: "Putt" },
            { id: "c10", key: "physical", label: "Physical" },
            { id: "c22", key: "etc", label: "Etc" },
        ],
    },
    {
        id: "m7",
        title: "상담",
        href: "/consultations",
        enabled: true,
        categories: [],
    },
    {
        id: "m8",
        title: "관리자",
        href: "/admin",
        enabled: true,
        categories: [],
    },
];

export default function MenuManagementPage() {
    const [menus, setMenus] = useState<MenuItem[]>(initialMenus);
    const [expandedMenuId, setExpandedMenuId] = useState<string | null>(null);

    // Edit menu name
    const [editingMenuId, setEditingMenuId] = useState<string | null>(null);
    const [editingMenuName, setEditingMenuName] = useState("");

    // Add menu modal
    const [isAddMenuModalOpen, setIsAddMenuModalOpen] = useState(false);
    const [newMenuTitle, setNewMenuTitle] = useState("");
    const [newMenuHref, setNewMenuHref] = useState("");

    // Add category
    const [addCategoryMenuId, setAddCategoryMenuId] = useState<string | null>(null);
    const [newCatKey, setNewCatKey] = useState("");
    const [newCatLabel, setNewCatLabel] = useState("");

    // Edit category
    const [editingCatId, setEditingCatId] = useState<string | null>(null);
    const [editingCatLabel, setEditingCatLabel] = useState("");

    // ── Drag & Drop State ──
    const [dragMenuIdx, setDragMenuIdx] = useState<number | null>(null);
    const [dragCatInfo, setDragCatInfo] = useState<{ menuId: string; catIdx: number } | null>(null);

    // ── Handlers: Menu ──
    const handleMoveMenu = (idx: number, direction: "up" | "down") => {
        const swap = direction === "up" ? idx - 1 : idx + 1;
        if (swap < 0 || swap >= menus.length) return;
        const updated = [...menus];
        [updated[idx], updated[swap]] = [updated[swap], updated[idx]];
        setMenus(updated);
    };

    const handleStartEditMenu = (menu: MenuItem) => {
        setEditingMenuId(menu.id);
        setEditingMenuName(menu.title);
    };

    const handleSaveEditMenu = () => {
        if (!editingMenuId || !editingMenuName.trim()) return;
        setMenus(menus.map(m => m.id === editingMenuId ? { ...m, title: editingMenuName.trim() } : m));
        setEditingMenuId(null);
    };

    const handleDeleteMenu = (id: string) => {
        if (confirm("이 메뉴를 삭제하시겠습니까?")) {
            setMenus(menus.filter(m => m.id !== id));
        }
    };

    const handleToggleMenu = (id: string) => {
        setMenus(menus.map(m => m.id === id ? { ...m, enabled: !m.enabled } : m));
    };

    const handleAddMenu = () => {
        if (!newMenuTitle.trim()) return;
        const newMenu: MenuItem = {
            id: `m_${Date.now()}`,
            title: newMenuTitle.trim(),
            href: newMenuHref.trim() || `/${newMenuTitle.trim().toLowerCase().replace(/\s+/g, "-")}`,
            enabled: true,
            categories: [],
        };
        setMenus([...menus, newMenu]);
        setIsAddMenuModalOpen(false);
        setNewMenuTitle("");
        setNewMenuHref("");
    };

    // ── Handlers: Categories ──
    const handleMoveCategory = (menuId: string, catIdx: number, direction: "up" | "down") => {
        setMenus(menus.map(m => {
            if (m.id !== menuId) return m;
            const cats = [...m.categories];
            const swap = direction === "up" ? catIdx - 1 : catIdx + 1;
            if (swap < 0 || swap >= cats.length) return m;
            [cats[catIdx], cats[swap]] = [cats[swap], cats[catIdx]];
            return { ...m, categories: cats };
        }));
    };

    const handleAddCategory = (menuId: string) => {
        if (!newCatLabel.trim()) return;
        const cat: CategoryItem = {
            id: `c_${Date.now()}`,
            key: newCatKey.trim() || newCatLabel.trim().toLowerCase().replace(/\s+/g, "_"),
            label: newCatLabel.trim(),
        };
        setMenus(menus.map(m => m.id === menuId ? { ...m, categories: [...m.categories, cat] } : m));
        setAddCategoryMenuId(null);
        setNewCatKey("");
        setNewCatLabel("");
    };

    const handleDeleteCategory = (menuId: string, catId: string) => {
        setMenus(menus.map(m => m.id === menuId ? { ...m, categories: m.categories.filter(c => c.id !== catId) } : m));
    };

    const handleStartEditCategory = (cat: CategoryItem) => {
        setEditingCatId(cat.id);
        setEditingCatLabel(cat.label);
    };

    const handleSaveEditCategory = (menuId: string) => {
        if (!editingCatId || !editingCatLabel.trim()) return;
        setMenus(menus.map(m => m.id === menuId ? {
            ...m,
            categories: m.categories.map(c => c.id === editingCatId ? { ...c, label: editingCatLabel.trim(), key: editingCatLabel.trim().toLowerCase().replace(/\s+/g, "_") } : c)
        } : m));
        setEditingCatId(null);
    };

    // ── Drag handlers for menus ──
    const handleMenuDragStart = (idx: number) => {
        setDragMenuIdx(idx);
    };
    const handleMenuDragOver = (e: React.DragEvent, idx: number) => {
        e.preventDefault();
        if (dragMenuIdx === null || dragMenuIdx === idx) return;
        const updated = [...menus];
        const [dragged] = updated.splice(dragMenuIdx, 1);
        updated.splice(idx, 0, dragged);
        setMenus(updated);
        setDragMenuIdx(idx);
    };
    const handleMenuDragEnd = () => {
        setDragMenuIdx(null);
    };

    // ── Drag handlers for categories ──
    const handleCatDragStart = (menuId: string, catIdx: number) => {
        setDragCatInfo({ menuId, catIdx });
    };
    const handleCatDragOver = (e: React.DragEvent, menuId: string, catIdx: number) => {
        e.preventDefault();
        if (!dragCatInfo || dragCatInfo.menuId !== menuId || dragCatInfo.catIdx === catIdx) return;
        setMenus(menus.map(m => {
            if (m.id !== menuId) return m;
            const cats = [...m.categories];
            const [dragged] = cats.splice(dragCatInfo.catIdx, 1);
            cats.splice(catIdx, 0, dragged);
            return { ...m, categories: cats };
        }));
        setDragCatInfo({ menuId, catIdx });
    };
    const handleCatDragEnd = () => {
        setDragCatInfo(null);
    };

    return (
        <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 pb-24">
            <main className="max-w-4xl mx-auto px-4 sm:px-8 py-10">
                {/* Header */}
                <div className="mb-8">
                    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                        <div>
                            <div className="flex items-center gap-2 mb-2">
                                <Settings2 size={24} className="text-brand-navy dark:text-brand-navy-light shrink-0" />
                                <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50 tracking-tight">
                                    메뉴 관리
                                </h1>
                            </div>
                            <p className="text-sm text-zinc-500 dark:text-zinc-400">
                                메뉴 이름 변경, 순서 조정 및 각 메뉴 내 카테고리(파트)를 추가·수정·정렬할 수 있습니다.
                            </p>
                        </div>
                        <button
                            onClick={() => setIsAddMenuModalOpen(true)}
                            className="flex items-center justify-center gap-2 px-5 py-2.5 bg-brand-navy hover:bg-brand-navy-light text-white text-sm font-bold rounded-xl transition-colors shadow-sm shrink-0 whitespace-nowrap"
                        >
                            <Plus size={16} />
                            메뉴 추가
                        </button>
                    </div>
                </div>

                {/* Menu List */}
                <div className="space-y-3">
                    {menus.map((menu, idx) => {
                        const isExpanded = expandedMenuId === menu.id;
                        const isEditing = editingMenuId === menu.id;

                        return (
                            <div
                                key={menu.id}
                                draggable
                                onDragStart={() => handleMenuDragStart(idx)}
                                onDragOver={(e) => handleMenuDragOver(e, idx)}
                                onDragEnd={handleMenuDragEnd}
                                className={cn(
                                    "bg-white dark:bg-zinc-900 border rounded-2xl overflow-hidden transition-all",
                                    dragMenuIdx === idx
                                        ? "border-brand-navy shadow-lg ring-2 ring-brand-navy/20 opacity-80"
                                        : "border-zinc-200 dark:border-zinc-800 shadow-sm",
                                    !menu.enabled && "opacity-50"
                                )}
                            >
                                {/* Menu Header Row */}
                                <div className="flex items-center gap-2 px-4 py-3 sm:px-5 sm:py-4">
                                    {/* Drag handle */}
                                    <div className="cursor-grab active:cursor-grabbing text-zinc-300 dark:text-zinc-600 hover:text-zinc-500 transition-colors shrink-0">
                                        <GripVertical size={18} />
                                    </div>

                                    {/* Order number */}
                                    <span className="shrink-0 w-7 h-7 flex items-center justify-center bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 rounded-lg text-xs font-black">
                                        {idx + 1}
                                    </span>

                                    {/* Menu title (editable or display) */}
                                    <div className="flex-1 min-w-0">
                                        {isEditing ? (
                                            <div className="flex items-center gap-2">
                                                <input
                                                    autoFocus
                                                    type="text"
                                                    value={editingMenuName}
                                                    onChange={(e) => setEditingMenuName(e.target.value)}
                                                    onKeyDown={(e) => { if (e.key === "Enter") handleSaveEditMenu(); if (e.key === "Escape") setEditingMenuId(null); }}
                                                    className="flex-1 px-3 py-1.5 text-sm font-bold rounded-lg border border-brand-navy bg-brand-navy/5 text-zinc-900 dark:text-zinc-100 outline-none focus:ring-2 focus:ring-brand-navy/40"
                                                />
                                                <button onClick={handleSaveEditMenu} className="p-1.5 text-brand-navy hover:bg-brand-navy/10 rounded-lg transition-colors">
                                                    <Save size={16} />
                                                </button>
                                                <button onClick={() => setEditingMenuId(null)} className="p-1.5 text-zinc-400 hover:text-zinc-600 rounded-lg transition-colors">
                                                    <X size={16} />
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-2">
                                                <span className="font-bold text-sm sm:text-base text-zinc-900 dark:text-zinc-100 truncate">{menu.title}</span>
                                                <span className="text-[10px] text-zinc-400 font-mono hidden sm:block">{menu.href}</span>
                                                {menu.categories.length > 0 && (
                                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-brand-navy/10 text-brand-navy dark:bg-brand-navy/20 dark:text-brand-navy-light whitespace-nowrap">
                                                        {menu.categories.length}개 카테고리
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {/* Actions */}
                                    <div className="flex items-center gap-0.5 shrink-0">
                                        {/* Move up/down */}
                                        <button onClick={() => handleMoveMenu(idx, "up")} disabled={idx === 0} className="p-1.5 text-zinc-400 hover:text-zinc-600 disabled:opacity-30 rounded-lg transition-colors">
                                            <ChevronUp size={16} />
                                        </button>
                                        <button onClick={() => handleMoveMenu(idx, "down")} disabled={idx === menus.length - 1} className="p-1.5 text-zinc-400 hover:text-zinc-600 disabled:opacity-30 rounded-lg transition-colors">
                                            <ChevronDown size={16} />
                                        </button>

                                        {/* Edit name */}
                                        <button onClick={() => handleStartEditMenu(menu)} className="p-1.5 text-zinc-400 hover:text-brand-navy hover:bg-brand-navy/10 rounded-lg transition-colors">
                                            <Edit2 size={14} />
                                        </button>

                                        {/* Toggle enable */}
                                        <button
                                            onClick={() => handleToggleMenu(menu.id)}
                                            className={cn(
                                                "relative w-9 h-5 rounded-full transition-colors shrink-0 mx-1",
                                                menu.enabled ? "bg-brand-navy" : "bg-zinc-300 dark:bg-zinc-700"
                                            )}
                                        >
                                            <div className={cn(
                                                "absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform",
                                                menu.enabled ? "left-[18px]" : "left-0.5"
                                            )} />
                                        </button>

                                        {/* Delete */}
                                        <button onClick={() => handleDeleteMenu(menu.id)} className="p-1.5 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors">
                                            <Trash2 size={14} />
                                        </button>

                                        {/* Expand categories */}
                                        <button
                                            onClick={() => setExpandedMenuId(isExpanded ? null : menu.id)}
                                            className={cn(
                                                "p-1.5 rounded-lg transition-colors",
                                                isExpanded ? "text-brand-navy bg-brand-navy/10" : "text-zinc-400 hover:text-zinc-600"
                                            )}
                                        >
                                            <Tag size={14} />
                                        </button>
                                    </div>
                                </div>

                                {/* Expanded: Categories */}
                                {isExpanded && (
                                    <div className="border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/30 px-4 sm:px-5 py-4 space-y-3">
                                        <div className="flex items-center justify-between mb-1">
                                            <h4 className="text-xs font-bold text-zinc-600 dark:text-zinc-400 flex items-center gap-1.5">
                                                <Tag size={12} />
                                                카테고리 관리 ({menu.categories.length})
                                            </h4>
                                            <button
                                                onClick={() => {
                                                    setAddCategoryMenuId(menu.id);
                                                    setNewCatKey("");
                                                    setNewCatLabel("");
                                                }}
                                                className="flex items-center gap-1 text-[11px] font-bold text-brand-navy hover:text-brand-navy-light bg-brand-navy/10 hover:bg-brand-navy/20 px-2.5 py-1 rounded-full transition-colors"
                                            >
                                                <Plus size={12} />
                                                추가
                                            </button>
                                        </div>

                                        {/* Category items */}
                                        {menu.categories.length > 0 ? (
                                            <div className="space-y-2">
                                                {menu.categories.map((cat, catIdx) => {
                                                    const isCatEditing = editingCatId === cat.id;
                                                    return (
                                                        <div
                                                            key={cat.id}
                                                            draggable
                                                            onDragStart={(e) => { e.stopPropagation(); handleCatDragStart(menu.id, catIdx); }}
                                                            onDragOver={(e) => { e.stopPropagation(); handleCatDragOver(e, menu.id, catIdx); }}
                                                            onDragEnd={(e) => { e.stopPropagation(); handleCatDragEnd(); }}
                                                            className={cn(
                                                                "flex items-center gap-2 px-3 py-2.5 bg-white dark:bg-zinc-900 rounded-xl border transition-all",
                                                                dragCatInfo?.menuId === menu.id && dragCatInfo.catIdx === catIdx
                                                                    ? "border-brand-navy ring-1 ring-brand-navy/20 opacity-80"
                                                                    : "border-zinc-200 dark:border-zinc-800"
                                                            )}
                                                        >
                                                            <div className="cursor-grab active:cursor-grabbing text-zinc-300 hover:text-zinc-500 transition-colors shrink-0">
                                                                <GripVertical size={14} />
                                                            </div>
                                                            <span className="shrink-0 w-5 h-5 flex items-center justify-center bg-zinc-100 dark:bg-zinc-800 text-zinc-500 rounded text-[10px] font-bold">
                                                                {catIdx + 1}
                                                            </span>

                                                            {isCatEditing ? (
                                                                <div className="flex-1 flex items-center gap-2">
                                                                    <input
                                                                        autoFocus
                                                                        type="text"
                                                                        value={editingCatLabel}
                                                                        onChange={(e) => setEditingCatLabel(e.target.value)}
                                                                        onKeyDown={(e) => { if (e.key === "Enter") handleSaveEditCategory(menu.id); if (e.key === "Escape") setEditingCatId(null); }}
                                                                        className="flex-1 px-2 py-1 text-xs font-semibold rounded-lg border border-brand-navy bg-brand-navy/5 text-zinc-900 dark:text-zinc-100 outline-none focus:ring-1 focus:ring-brand-navy/40"
                                                                    />
                                                                    <button onClick={() => handleSaveEditCategory(menu.id)} className="p-1 text-brand-navy hover:bg-brand-navy/10 rounded transition-colors"><Save size={12} /></button>
                                                                    <button onClick={() => setEditingCatId(null)} className="p-1 text-zinc-400 hover:text-zinc-600 rounded transition-colors"><X size={12} /></button>
                                                                </div>
                                                            ) : (
                                                                <div className="flex-1 flex items-center gap-2 min-w-0">
                                                                    <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 truncate">{cat.label}</span>
                                                                    <span className="text-[10px] text-zinc-400 font-mono truncate hidden sm:block">{cat.key}</span>
                                                                </div>
                                                            )}

                                                            <div className="flex items-center gap-0.5 shrink-0">
                                                                <button onClick={() => handleMoveCategory(menu.id, catIdx, "up")} disabled={catIdx === 0} className="p-1 text-zinc-400 hover:text-zinc-600 disabled:opacity-30 rounded transition-colors"><ChevronUp size={14} /></button>
                                                                <button onClick={() => handleMoveCategory(menu.id, catIdx, "down")} disabled={catIdx === menu.categories.length - 1} className="p-1 text-zinc-400 hover:text-zinc-600 disabled:opacity-30 rounded transition-colors"><ChevronDown size={14} /></button>
                                                                <button onClick={() => handleStartEditCategory(cat)} className="p-1 text-zinc-400 hover:text-brand-navy rounded transition-colors"><Edit2 size={12} /></button>
                                                                <button onClick={() => handleDeleteCategory(menu.id, cat.id)} className="p-1 text-zinc-400 hover:text-red-500 rounded transition-colors"><Trash2 size={12} /></button>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        ) : (
                                            <div className="text-center py-6 bg-white dark:bg-zinc-900 rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800">
                                                <Tag size={20} className="mx-auto text-zinc-300 mb-2" />
                                                <p className="text-xs text-zinc-400">등록된 카테고리가 없습니다.</p>
                                            </div>
                                        )}

                                        {/* Add Category Inline Form */}
                                        {addCategoryMenuId === menu.id && (
                                            <div className="flex flex-col sm:flex-row gap-2 p-3 bg-white dark:bg-zinc-900 rounded-xl border border-brand-navy/30 mt-2">
                                                <input
                                                    autoFocus
                                                    type="text"
                                                    placeholder="카테고리 이름 (예: Around Green)"
                                                    value={newCatLabel}
                                                    onChange={(e) => setNewCatLabel(e.target.value)}
                                                    onKeyDown={(e) => { if (e.key === "Enter") handleAddCategory(menu.id); }}
                                                    className="flex-1 px-3 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 outline-none focus:ring-2 focus:ring-brand-navy/40"
                                                />
                                                <input
                                                    type="text"
                                                    placeholder="키 (예: around_green, 비워두면 자동)"
                                                    value={newCatKey}
                                                    onChange={(e) => setNewCatKey(e.target.value)}
                                                    className="flex-1 px-3 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 outline-none focus:ring-2 focus:ring-brand-navy/40 hidden sm:block"
                                                />
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => handleAddCategory(menu.id)}
                                                        className="px-4 py-2 bg-brand-navy text-white text-xs font-bold rounded-lg hover:bg-brand-navy-light transition-colors"
                                                    >
                                                        추가
                                                    </button>
                                                    <button
                                                        onClick={() => setAddCategoryMenuId(null)}
                                                        className="px-3 py-2 text-zinc-500 text-xs font-bold rounded-lg hover:bg-zinc-100 transition-colors"
                                                    >
                                                        취소
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {menus.length === 0 && (
                    <div className="flex flex-col items-center justify-center p-12 bg-white dark:bg-zinc-900 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl mt-4">
                        <Menu size={48} className="text-zinc-300 mb-4" />
                        <h3 className="text-lg font-bold text-zinc-700 dark:text-zinc-300 mb-1">등록된 메뉴가 없습니다</h3>
                        <p className="text-sm text-zinc-500 text-center">상단의 메뉴 추가 버튼을 눌러 새 메뉴를 등록해보세요.</p>
                    </div>
                )}

                {/* Save/Apply notice */}
                <div className="mt-8 p-4 bg-brand-navy/5 border border-brand-navy/10 rounded-2xl text-center">
                    <p className="text-xs text-brand-navy dark:text-brand-navy-light font-medium">
                        💡 변경 사항은 실시간으로 반영됩니다. 드래그하거나 ▲▼ 버튼으로 순서를 변경하세요.
                    </p>
                </div>
            </main>

            {/* Add Menu Modal */}
            {isAddMenuModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl w-full max-w-md border border-zinc-200 dark:border-zinc-800 overflow-hidden">
                        <div className="p-5 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center bg-zinc-50 dark:bg-zinc-900/50">
                            <h2 className="font-bold text-lg text-zinc-900 dark:text-zinc-100">새 메뉴 추가</h2>
                            <button onClick={() => setIsAddMenuModalOpen(false)} className="p-1.5 text-zinc-400 hover:text-zinc-900 bg-white rounded-lg border border-zinc-200">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-6 space-y-5">
                            <div>
                                <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">메뉴 이름</label>
                                <input
                                    autoFocus
                                    type="text"
                                    value={newMenuTitle}
                                    onChange={(e) => setNewMenuTitle(e.target.value)}
                                    placeholder="예) 체력측정, 영상분석"
                                    onKeyDown={(e) => { if (e.key === "Enter") handleAddMenu(); }}
                                    className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-sm focus:outline-none focus:ring-2 focus:ring-brand-navy/40 transition-all"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">경로 (선택)</label>
                                <input
                                    type="text"
                                    value={newMenuHref}
                                    onChange={(e) => setNewMenuHref(e.target.value)}
                                    placeholder="/new-menu (비워두면 자동 생성)"
                                    className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-sm focus:outline-none focus:ring-2 focus:ring-brand-navy/40 transition-all"
                                />
                            </div>
                            <button
                                onClick={handleAddMenu}
                                className="w-full py-3 bg-brand-navy text-white rounded-xl font-bold hover:bg-brand-navy-light transition-colors mt-2"
                            >
                                추가하기
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
