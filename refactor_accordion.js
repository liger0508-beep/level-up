const fs = require('fs');
const path = require('path');

function refactorAccordionCreate(filePath) {
    let content = fs.readFileSync(filePath, 'utf-8');
    
    // Add isHolesOpen state
    content = content.replace(/const \[openHoles, setOpenHoles\] = useState<Record<number, boolean>>\({}\);/, 'const [openHoles, setOpenHoles] = useState<Record<number, boolean>>({});\n    const [isHolesOpen, setIsHolesOpen] = useState(false);');

    // Replace the Hole Information section
    const oldSectionRegex = /<section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-3xl shadow-sm space-y-4">[\s\S]*?{Array\.from\(\{ length: 18 \}, \(_, i\) => i \+ 1\)\.map\(\(hole\) => \([\s\S]*?<\/div>[\s]*?\)\)}[\s]*?<\/div>[\s]*?<\/section>/;
    
    const newSection = `<section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-sm overflow-hidden">
                        <button
                            type="button"
                            onClick={() => setIsHolesOpen(!isHolesOpen)}
                            className="w-full flex items-center justify-between p-6 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
                        >
                            <label className="text-sm font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-2 cursor-pointer">
                                <Layout size={18} className="text-zinc-400" />
                                홀별 추가 정보 기입
                            </label>
                            {isHolesOpen ? <ChevronUp size={20} className="text-zinc-400" /> : <ChevronDown size={20} className="text-zinc-400" />}
                        </button>

                        {isHolesOpen && (
                            <div className="px-6 pb-6 space-y-3 border-t border-zinc-100 dark:border-zinc-800 pt-4">
                                {Array.from({ length: 18 }, (_, i) => i + 1).map((hole) => (
                                    <div key={hole} className="border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden bg-zinc-50 dark:bg-zinc-800/50">
                                        <button
                                            type="button"
                                            onClick={() => toggleHole(hole)}
                                            className="w-full flex items-center justify-between px-4 py-3 text-sm font-bold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                                        >
                                            <span>{hole}번 홀</span>
                                            {openHoles[hole] ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                                        </button>
                                        {openHoles[hole] && (
                                            <div className="p-4 pt-4 border-t border-zinc-200 dark:border-zinc-800">
                                                <textarea
                                                    rows={3}
                                                    value={holes[hole] || ""}
                                                    onChange={(e) => handleHoleChange(hole, e.target.value)}
                                                    placeholder={\`\${hole}번 홀의 추가 정보를 입력하세요...\`}
                                                    className="w-full p-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-brand-navy/40 transition-all resize-y"
                                                />
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>`;

    content = content.replace(oldSectionRegex, newSection);
    fs.writeFileSync(filePath, content, 'utf-8');
}

function refactorAccordionEdit(filePath) {
    let content = fs.readFileSync(filePath, 'utf-8');
    
    // Add isHolesOpen state
    content = content.replace(/const \[openHoles, setOpenHoles\] = useState<Record<number, boolean>>\({}\);/, 'const [openHoles, setOpenHoles] = useState<Record<number, boolean>>({});\n    const [isHolesOpen, setIsHolesOpen] = useState(false);');

    // Replace the Hole Information section
    const oldSectionRegex = /<section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-3xl shadow-sm space-y-4">[\s\S]*?{Array\.from\(\{ length: 18 \}, \(_, i\) => i \+ 1\)\.map\(\(hole\) => \([\s\S]*?<\/div>[\s]*?\)\)}[\s]*?<\/div>[\s]*?<\/section>/;
    
    const newSection = `<section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-sm overflow-hidden">
                        <button
                            type="button"
                            onClick={() => setIsHolesOpen(!isHolesOpen)}
                            className="w-full flex items-center justify-between p-6 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
                        >
                            <label className="text-sm font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-2 cursor-pointer">
                                <Layout size={18} className="text-zinc-400" />
                                홀별 추가 정보 기입
                            </label>
                            {isHolesOpen ? <ChevronUp size={20} className="text-zinc-400" /> : <ChevronDown size={20} className="text-zinc-400" />}
                        </button>

                        {isHolesOpen && (
                            <div className="px-6 pb-6 space-y-3 border-t border-zinc-100 dark:border-zinc-800 pt-4">
                                {Array.from({ length: 18 }, (_, i) => i + 1).map((hole) => (
                                    <div key={hole} className="border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden bg-zinc-50 dark:bg-zinc-800/50">
                                        <button
                                            type="button"
                                            onClick={() => toggleHole(hole)}
                                            className="w-full flex items-center justify-between px-4 py-3 text-sm font-bold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                                        >
                                            <span>{hole}번 홀</span>
                                            {openHoles[hole] ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                                        </button>
                                        {openHoles[hole] && (
                                            <div className="p-4 pt-4 border-t border-zinc-200 dark:border-zinc-800">
                                                <textarea
                                                    rows={3}
                                                    value={holes[hole] || ""}
                                                    onChange={(e) => handleHoleChange(hole, e.target.value)}
                                                    placeholder={\`\${hole}번 홀의 추가 정보를 입력하세요...\`}
                                                    className="w-full p-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-brand-navy/40 transition-all resize-y"
                                                />
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>`;

    content = content.replace(oldSectionRegex, newSection);
    fs.writeFileSync(filePath, content, 'utf-8');
}

function refactorAccordionDetail(filePath) {
    let content = fs.readFileSync(filePath, 'utf-8');
    
    // Add isHolesOpen state
    content = content.replace(/const \[openHoles, setOpenHoles\] = useState<Record<number, boolean>>\({}\);/, 'const [openHoles, setOpenHoles] = useState<Record<number, boolean>>({});\n    const [isHolesOpen, setIsHolesOpen] = useState(false);');

    // Add Layout icon import if not present
    if (!content.includes('Layout')) {
        content = content.replace(/Map/, 'Map,\n    Layout');
    }

    // Replace the Hole Information section
    const oldSectionRegex = /<section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-3xl shadow-sm space-y-4">[\s\S]*?<h3 className="text-lg font-bold text-zinc-800 dark:text-zinc-200 mb-4">홀별 추가 정보<\/h3>[\s\S]*?{Array\.from\(\{ length: 18 \}, \(_, i\) => i \+ 1\)\.map\(\(hole\) => \{[\s\S]*?<\/div>[\s]*?\);[\s]*?}\)}[\s]*?<\/div>[\s]*?<\/section>/;
    
    const newSection = `<section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-sm overflow-hidden">
                    <button
                        type="button"
                        onClick={() => setIsHolesOpen(!isHolesOpen)}
                        className="w-full flex items-center justify-between p-6 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
                    >
                        <label className="text-sm font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-2 cursor-pointer">
                            <Layout size={18} className="text-zinc-400" />
                            홀별 추가 정보
                        </label>
                        {isHolesOpen ? <ChevronUp size={20} className="text-zinc-400" /> : <ChevronDown size={20} className="text-zinc-400" />}
                    </button>

                    {isHolesOpen && (
                        <div className="px-6 pb-6 space-y-3 border-t border-zinc-100 dark:border-zinc-800 pt-4">
                            {Array.from({ length: 18 }, (_, i) => i + 1).map((hole) => {
                                const hasInfo = !!holes[hole];
                                return (
                                    <div key={hole} className="border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden bg-zinc-50 dark:bg-zinc-800/50">
                                        <button
                                            type="button"
                                            onClick={() => toggleHole(hole)}
                                            className="w-full flex items-center justify-between px-4 py-3 text-sm font-bold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                                        >
                                            <div className="flex items-center gap-3">
                                                <span>{hole}번 홀</span>
                                                {hasInfo && (
                                                    <span className="text-[10px] bg-brand-navy text-white px-2 py-0.5 rounded-full">정보 있음</span>
                                                )}
                                            </div>
                                            {openHoles[hole] ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                                        </button>
                                        {openHoles[hole] && (
                                            <div className="p-4 pt-4 border-t border-zinc-200 dark:border-zinc-800">
                                                <div className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-sm text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap">
                                                    {holes[hole] || "등록된 추가 정보가 없습니다."}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </section>`;

    content = content.replace(oldSectionRegex, newSection);
    fs.writeFileSync(filePath, content, 'utf-8');
}

refactorAccordionCreate(path.join(__dirname, 'src/app/(main)/course-info/create/page.tsx'));
refactorAccordionEdit(path.join(__dirname, 'src/app/(main)/course-info/[id]/edit/page.tsx'));
refactorAccordionDetail(path.join(__dirname, 'src/app/(main)/course-info/[id]/page.tsx'));
console.log("Master Accordion implemented.");
