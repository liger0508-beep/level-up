const fs = require('fs');
let content = fs.readFileSync('src/app/(main)/admin/statistics/page.tsx', 'utf8');

// 1. Imports
content = content.replace(
    'import { fetchMonthlyStatistics, MonthlyStatistic } from "@/lib/statistics-sync";',
    'import { fetchMonthlyStatistics, MonthlyStatistic, fetchCoachMonthlyStatistics, CoachMonthlyStatistic } from "@/lib/statistics-sync";'
);

// 2. States & Data Loading
const stateTarget = `    const [selectedBranch, setSelectedBranch] = useState("전체");
    const [selectedCoach, setSelectedCoach] = useState("전체");
    const [data, setData] = useState<MonthlyStatistic[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        let isMounted = true;
        const loadData = async () => {
            setIsLoading(true);
            const [year, month] = selectedMonth.split("-").map(Number);
            const stats = await fetchMonthlyStatistics(year, month);
            if (isMounted) {
                setData(stats);
                setIsLoading(false);
            }
        };
        loadData();
        return () => { isMounted = false; };
    }, [selectedMonth]);

    const branches = ["전체", ...Array.from(new Set(data.map(d => d.branch))).filter(Boolean).sort()];`;

const stateReplacement = `    const [tab, setTab] = useState<"athlete" | "coach">("athlete");
    const [selectedBranch, setSelectedBranch] = useState("전체");
    const [selectedCoach, setSelectedCoach] = useState("전체");
    const [data, setData] = useState<MonthlyStatistic[]>([]);
    const [coachData, setCoachData] = useState<CoachMonthlyStatistic[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        let isMounted = true;
        const loadData = async () => {
            setIsLoading(true);
            const [year, month] = selectedMonth.split("-").map(Number);
            const stats = await fetchMonthlyStatistics(year, month);
            const cStats = await fetchCoachMonthlyStatistics(year, month);
            if (isMounted) {
                setData(stats);
                setCoachData(cStats);
                setIsLoading(false);
            }
        };
        loadData();
        return () => { isMounted = false; };
    }, [selectedMonth]);

    const branches = ["전체", "조이마루점", "구미점", "미지정"];`;

content = content.replace(stateTarget, stateReplacement);

// 3. Filter Data
const filterTarget = `    const filteredData = data.filter(d => {
        const matchUser = !selectedUser || d.name.includes(selectedUser) || d.coach.includes(selectedUser);
        const matchBranch = selectedBranch === "전체" || d.branch === selectedBranch;
        const matchCoach = selectedCoach === "전체" || d.coach === selectedCoach;
        return matchUser && matchBranch && matchCoach;
    });`;
const filterReplacement = `    const filteredData = data.filter(d => {
        const matchUser = !selectedUser || d.name.includes(selectedUser) || d.coach.includes(selectedUser);
        const matchBranch = selectedBranch === "전체" || d.branch === selectedBranch;
        const matchCoach = selectedCoach === "전체" || d.coach === selectedCoach;
        return matchUser && matchBranch && matchCoach;
    });

    const filteredCoachData = coachData.filter(d => {
        const matchUser = !selectedUser || d.name.includes(selectedUser);
        const matchBranch = selectedBranch === "전체" || d.branch === selectedBranch;
        return matchUser && matchBranch;
    });`;
content = content.replace(filterTarget, filterReplacement);

// 4. Tabs UI
const titleTarget = `                <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">지정된 기간 동안의 지표를 분석합니다.</p>
            </div>`;
const titleReplacement = `                <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">지정된 기간 동안의 지표를 분석합니다.</p>
            </div>

            {/* Tabs */}
            <div className="flex bg-zinc-100 dark:bg-zinc-800 p-1 rounded-xl w-fit mb-6">
                <button 
                    onClick={() => setTab("athlete")}
                    className={\`px-4 py-2 rounded-lg text-sm font-bold transition-all \${tab === "athlete" ? "bg-white shadow-sm text-zinc-900" : "text-zinc-500"}\`}
                >
                    선수 통계
                </button>
                <button 
                    onClick={() => setTab("coach")}
                    className={\`px-4 py-2 rounded-lg text-sm font-bold transition-all \${tab === "coach" ? "bg-white shadow-sm text-zinc-900" : "text-zinc-500"}\`}
                >
                    코치 통계
                </button>
            </div>`;
content = content.replace(titleTarget, titleReplacement);

// 5. Branch Button Label & Coach Filter Hide
const branchLabelTarget = `{b === "전체" ? "ALL" : b}`;
const branchLabelReplacement = `{b}`;
content = content.replace(branchLabelTarget, branchLabelReplacement);

const coachFilterTarget = `<div className="space-y-3 w-full overflow-hidden">
                    <label className="block text-base font-bold text-zinc-900 dark:text-zinc-100">담임 코치</label>`;
const coachFilterReplacement = `{tab === "athlete" && (
                <div className="space-y-3 w-full overflow-hidden">
                    <label className="block text-base font-bold text-zinc-900 dark:text-zinc-100">담임 코치</label>`;
content = content.replace(coachFilterTarget, coachFilterReplacement);

const coachFilterEndTarget = `                            </button>
                        ))}
                    </div>
                </div>
            </div>`;
const coachFilterEndReplacement = `                            </button>
                        ))}
                    </div>
                </div>
            )}
            </div>`;
content = content.replace(coachFilterEndTarget, coachFilterEndReplacement);

// 6. The Table
const tableTarget = `<div className="inline-block min-w-full align-middle relative">
                        {isLoading && (
                            <div className="absolute inset-0 bg-white/50 dark:bg-zinc-900/50 flex items-center justify-center z-20 backdrop-blur-[1px]">
                                <span className="text-sm font-bold text-brand-navy">불러오는 중...</span>
                            </div>
                        )}
                        <table className="min-w-full text-sm text-left border-collapse">
                            <thead className="text-[11px] uppercase tracking-wider text-zinc-400 dark:text-zinc-500 border-b border-zinc-100 dark:border-zinc-800">
                                <tr>
                                    <th className="px-6 py-4 font-bold sticky left-0 z-10 bg-zinc-50 dark:bg-zinc-800/20 border-r border-zinc-100 dark:border-zinc-800 whitespace-nowrap shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">이름</th>
                                    <th className="px-6 py-4 font-bold text-center whitespace-nowrap">담임 코치</th>
                                    <th className="px-6 py-4 font-bold text-center whitespace-nowrap">레슨 (담임)</th>
                                    <th className="px-6 py-4 font-bold text-center whitespace-nowrap">훈련 (담임)</th>
                                    <th className="px-6 py-4 font-bold text-center whitespace-nowrap">챌린지</th>
                                    <th className="px-6 py-4 font-bold text-center whitespace-nowrap">스코어</th>
                                    <th className="px-6 py-4 font-bold text-center whitespace-nowrap">상담</th>
                                    <th className="px-6 py-4 font-bold text-center whitespace-nowrap">훈련일지</th>
                                    <th className="px-6 py-4 font-bold text-center whitespace-nowrap">선수 레포트 조회</th>
                                    <th className="px-6 py-4 font-bold text-center whitespace-nowrap">접속</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-50 dark:divide-zinc-800/30">
                                {filteredData.length === 0 && !isLoading ? (
                                    <tr>
                                        <td colSpan={10} className="px-6 py-12 text-center text-zinc-500">데이터가 없습니다.</td>
                                    </tr>
                                ) : (
                                    filteredData.map((d) => (
                                        <tr key={d.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors group">
                                            <td className="px-6 py-4 font-bold text-zinc-900 dark:text-zinc-100 sticky left-0 z-10 bg-white dark:bg-zinc-900 group-hover:bg-zinc-50 dark:group-hover:bg-zinc-800/40 border-r border-zinc-100 dark:border-zinc-800 whitespace-nowrap shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] transition-colors">
                                                {d.name}
                                            </td>
                                            <td className="px-6 py-4 text-center font-medium text-zinc-800 dark:text-zinc-200 whitespace-nowrap">{d.coach}</td>
                                            <td className="px-6 py-4 text-center font-medium text-zinc-600 dark:text-zinc-400 whitespace-nowrap">
                                                {d.lesson.toLocaleString()} <span className="text-brand-navy font-bold">({d.lessonByCoach.toLocaleString()})</span>
                                            </td>
                                            <td className="px-6 py-4 text-center font-medium text-zinc-600 dark:text-zinc-400 whitespace-nowrap">
                                                {d.training.toLocaleString()} <span className="text-brand-navy font-bold">({d.trainingByCoach.toLocaleString()})</span>
                                            </td>
                                            <td className="px-6 py-4 text-center font-medium text-zinc-600 dark:text-zinc-400">{d.challenge.toLocaleString()}</td>
                                            <td className="px-6 py-4 text-center font-medium text-zinc-600 dark:text-zinc-400">{d.score.toLocaleString()}</td>
                                            <td className="px-6 py-4 text-center font-medium text-zinc-600 dark:text-zinc-400">{d.consultation.toLocaleString()}</td>
                                            <td className="px-6 py-4 text-center font-medium text-zinc-600 dark:text-zinc-400">{d.trainingLog.toLocaleString()}</td>
                                            <td className="px-6 py-4 text-center font-medium text-zinc-600 dark:text-zinc-400">{d.reportView.toLocaleString()}</td>
                                            <td className="px-6 py-4 text-center font-medium text-zinc-600 dark:text-zinc-400">{d.login.toLocaleString()}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>`;

const tableReplacement = `<div className="inline-block min-w-full align-middle relative">
                        {isLoading && (
                            <div className="absolute inset-0 bg-white/50 dark:bg-zinc-900/50 flex items-center justify-center z-20 backdrop-blur-[1px]">
                                <span className="text-sm font-bold text-brand-navy">불러오는 중...</span>
                            </div>
                        )}
                        {tab === "athlete" ? (
                        <table className="min-w-full text-sm text-left border-collapse">
                            <thead className="text-[11px] uppercase tracking-wider text-zinc-400 dark:text-zinc-500 border-b border-zinc-100 dark:border-zinc-800">
                                <tr>
                                    <th className="px-6 py-4 font-bold sticky left-0 z-10 bg-zinc-50 dark:bg-zinc-800/20 border-r border-zinc-100 dark:border-zinc-800 whitespace-nowrap shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">이름</th>
                                    <th className="px-6 py-4 font-bold text-center whitespace-nowrap">담임 코치</th>
                                    <th className="px-6 py-4 font-bold text-center whitespace-nowrap">레슨 (담임)</th>
                                    <th className="px-6 py-4 font-bold text-center whitespace-nowrap">훈련 (담임)</th>
                                    <th className="px-6 py-4 font-bold text-center whitespace-nowrap">챌린지</th>
                                    <th className="px-6 py-4 font-bold text-center whitespace-nowrap">스코어</th>
                                    <th className="px-6 py-4 font-bold text-center whitespace-nowrap">상담</th>
                                    <th className="px-6 py-4 font-bold text-center whitespace-nowrap">훈련일지</th>
                                    <th className="px-6 py-4 font-bold text-center whitespace-nowrap">선수 레포트 조회</th>
                                    <th className="px-6 py-4 font-bold text-center whitespace-nowrap">접속</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-50 dark:divide-zinc-800/30">
                                {filteredData.length === 0 && !isLoading ? (
                                    <tr>
                                        <td colSpan={10} className="px-6 py-12 text-center text-zinc-500">데이터가 없습니다.</td>
                                    </tr>
                                ) : (
                                    filteredData.map((d) => (
                                        <tr key={d.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors group">
                                            <td className="px-6 py-4 font-bold text-zinc-900 dark:text-zinc-100 sticky left-0 z-10 bg-white dark:bg-zinc-900 group-hover:bg-zinc-50 dark:group-hover:bg-zinc-800/40 border-r border-zinc-100 dark:border-zinc-800 whitespace-nowrap shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] transition-colors">
                                                {d.name}
                                            </td>
                                            <td className="px-6 py-4 text-center font-medium text-zinc-800 dark:text-zinc-200 whitespace-nowrap">{d.coach}</td>
                                            <td className="px-6 py-4 text-center font-medium text-zinc-600 dark:text-zinc-400 whitespace-nowrap">
                                                {d.lesson.toLocaleString()} <span className="text-brand-navy font-bold">({d.lessonByCoach.toLocaleString()})</span>
                                            </td>
                                            <td className="px-6 py-4 text-center font-medium text-zinc-600 dark:text-zinc-400 whitespace-nowrap">
                                                {d.training.toLocaleString()} <span className="text-brand-navy font-bold">({d.trainingByCoach.toLocaleString()})</span>
                                            </td>
                                            <td className="px-6 py-4 text-center font-medium text-zinc-600 dark:text-zinc-400">{d.challenge.toLocaleString()}</td>
                                            <td className="px-6 py-4 text-center font-medium text-zinc-600 dark:text-zinc-400">{d.score.toLocaleString()}</td>
                                            <td className="px-6 py-4 text-center font-medium text-zinc-600 dark:text-zinc-400">{d.consultation.toLocaleString()}</td>
                                            <td className="px-6 py-4 text-center font-medium text-zinc-600 dark:text-zinc-400">{d.trainingLog.toLocaleString()}</td>
                                            <td className="px-6 py-4 text-center font-medium text-zinc-600 dark:text-zinc-400">{d.reportView.toLocaleString()}</td>
                                            <td className="px-6 py-4 text-center font-medium text-zinc-600 dark:text-zinc-400">{d.login.toLocaleString()}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                        ) : (
                        <table className="min-w-full text-sm text-left border-collapse">
                            <thead className="text-[11px] uppercase tracking-wider text-zinc-400 dark:text-zinc-500 border-b border-zinc-100 dark:border-zinc-800">
                                <tr>
                                    <th className="px-6 py-4 font-bold sticky left-0 z-10 bg-zinc-50 dark:bg-zinc-800/20 border-r border-zinc-100 dark:border-zinc-800 whitespace-nowrap shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">이름 (지점)</th>
                                    <th className="px-6 py-4 font-bold text-center whitespace-nowrap">레슨</th>
                                    <th className="px-6 py-4 font-bold text-center whitespace-nowrap">훈련</th>
                                    <th className="px-6 py-4 font-bold text-center whitespace-nowrap">챌린지</th>
                                    <th className="px-6 py-4 font-bold text-center whitespace-nowrap">상담</th>
                                    <th className="px-6 py-4 font-bold text-center whitespace-nowrap">댓글</th>
                                    <th className="px-6 py-4 font-bold text-center whitespace-nowrap">레포트 작성률</th>
                                    <th className="px-6 py-4 font-bold text-center whitespace-nowrap">접속</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-50 dark:divide-zinc-800/30">
                                {filteredCoachData.length === 0 && !isLoading ? (
                                    <tr>
                                        <td colSpan={8} className="px-6 py-12 text-center text-zinc-500">데이터가 없습니다.</td>
                                    </tr>
                                ) : (
                                    filteredCoachData.map((d) => (
                                        <tr key={d.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors group">
                                            <td className="px-6 py-4 font-bold text-zinc-900 dark:text-zinc-100 sticky left-0 z-10 bg-white dark:bg-zinc-900 group-hover:bg-zinc-50 dark:group-hover:bg-zinc-800/40 border-r border-zinc-100 dark:border-zinc-800 whitespace-nowrap shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] transition-colors">
                                                {d.name} <span className="font-normal text-zinc-400">({d.branch})</span>
                                            </td>
                                            <td className="px-6 py-4 text-center font-medium text-zinc-600 dark:text-zinc-400 whitespace-nowrap">{d.lesson.toLocaleString()}</td>
                                            <td className="px-6 py-4 text-center font-medium text-zinc-600 dark:text-zinc-400 whitespace-nowrap">{d.training.toLocaleString()}</td>
                                            <td className="px-6 py-4 text-center font-medium text-zinc-600 dark:text-zinc-400">{d.challenge.toLocaleString()}</td>
                                            <td className="px-6 py-4 text-center font-medium text-zinc-600 dark:text-zinc-400">{d.consultation.toLocaleString()}</td>
                                            <td className="px-6 py-4 text-center font-medium text-zinc-600 dark:text-zinc-400">{d.comment.toLocaleString()}</td>
                                            <td className="px-6 py-4 text-center font-medium text-zinc-600 dark:text-zinc-400">{d.reportRate}%</td>
                                            <td className="px-6 py-4 text-center font-medium text-zinc-600 dark:text-zinc-400">{d.login.toLocaleString()}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                        )}
                    </div>`;
content = content.replace(tableTarget, tableReplacement);

fs.writeFileSync('src/app/(main)/admin/statistics/page.tsx', content);
