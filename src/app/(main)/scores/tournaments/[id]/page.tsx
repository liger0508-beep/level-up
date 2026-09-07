"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Trophy, Calendar, MapPin, Lock, ChevronLeft, Loader2, KeyRound, Plus, FileSignature, CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { PageTitle } from "@/components/ui/Typography";
import { LiveScoreModal } from "@/components/ui/LiveScoreModal";
import { SignaturePad } from "@/components/ui/SignaturePad";

export default function TournamentDetailPage() {
    const params = useParams();
    const router = useRouter();
    const tournamentId = params.id as string;
    
    const [loading, setLoading] = useState(true);
    const [checkingAccess, setCheckingAccess] = useState(true);
    const [hasAccess, setHasAccess] = useState(false);
    
    const [tournament, setTournament] = useState<any>(null);
    const [passwordInput, setPasswordInput] = useState("");
    const [joinLoading, setJoinLoading] = useState(false);
    const [userId, setUserId] = useState<string | null>(null);
    const [userRole, setUserRole] = useState<string>('athlete');
    const [draftId, setDraftId] = useState<string | null>(null);
    const [leaderboard, setLeaderboard] = useState<any[]>([]);
    const [scorecardsMap, setScorecardsMap] = useState<Record<string, any>>({});

    // Category & Live Score State
    const [activeTab, setActiveTab] = useState<'total' | 'tee' | 'second' | 'around' | 'putting'>('total');
    const [selectedLiveScoreAthlete, setSelectedLiveScoreAthlete] = useState<{id: string, name: string} | null>(null);

    // Signature Modal State
    const [showSignatureModal, setShowSignatureModal] = useState(false);
    const [signatureType, setSignatureType] = useState<'player' | 'referee'>('player');
    const [signatureStep, setSignatureStep] = useState<'marker' | 'player' | 'referee'>('marker');
    const [targetScorecardId, setTargetScorecardId] = useState<string | null>(null);
    const [tempMarkerSignature, setTempMarkerSignature] = useState<string | null>(null);

    useEffect(() => {
        const load = async () => {
            const supabase = createClient();
            
            // 1. Get User and Role
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                router.push("/login");
                return;
            }
            setUserId(user.id);
            
            const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single();
            if (profile) {
                setUserRole(profile.role);
            }

            // 2. Load Tournament Info
            const { data: tData } = await supabase
                .from("score_tournaments")
                .select("*")
                .eq("id", tournamentId)
                .single();
                
            if (!tData) {
                alert("존재하지 않는 토너먼트입니다.");
                router.push("/scores/tournaments");
                return;
            }
            setTournament(tData);

            // 3. Check if user is already a participant OR if user is admin/coach
            // For now, let's assume everyone needs the password to join as an athlete,
            // but admins/coaches bypass this? Let's check participation table first.
            const { data: participantData } = await supabase
                .from("tournament_participants")
                .select("*")
                .eq("tournament_id", tournamentId)
                .eq("athlete_id", user.id)
                .maybeSingle();

            if (participantData) {
                setHasAccess(true);
            }

            // 4. Check for existing draft scorecard for this tournament
            const { data: draftData } = await supabase
                .from("scorecards")
                .select("id")
                .eq("tournament_id", tournamentId)
                .eq("athlete_id", user.id)
                .eq("is_final", false)
                .limit(1)
                .maybeSingle();

            if (draftData) {
                setDraftId(draftData.id);
            }

            // 5. Load Leaderboard
            const { data: lbData } = await supabase
                .from("tournament_leaderboards")
                .select(`
                    id,
                    round_number,
                    thru_hole,
                    total_score,
                    rank_score,
                    rank_tee_shot,
                    rank_second_shot,
                    rank_around_green,
                    rank_putting,
                    athlete:users!tournament_leaderboards_athlete_id_fkey(id, name, branch)
                `)
                .eq("tournament_id", tournamentId);
                
            if (lbData) {
                setLeaderboard(lbData);
            }
            
            // 6. Load Scorecards for Signature Status
            const { data: scData } = await supabase
                .from("scorecards")
                .select("id, athlete_id, marker_signature, player_signature, referee_signature")
                .eq("tournament_id", tournamentId)
                .eq("is_final", true);
                
            if (scData) {
                const map: Record<string, any> = {};
                scData.forEach(sc => {
                    map[sc.athlete_id] = sc;
                });
                setScorecardsMap(map);
            }
            
            setCheckingAccess(false);
            setLoading(false);
        };
        load();
    }, [tournamentId, router]);

    const handleJoin = async (e: React.FormEvent) => {
        e.preventDefault();
        setJoinLoading(true);
        
        const supabase = createClient();
        
        // Check password
        const { data: checkData } = await supabase
            .from("score_tournaments")
            .select("password")
            .eq("id", tournamentId)
            .single();
            
        if (checkData?.password !== passwordInput) {
            alert("비밀번호가 일치하지 않습니다.");
            setJoinLoading(false);
            return;
        }
        
        // Join
        const { error } = await supabase
            .from("tournament_participants")
            .insert({
                tournament_id: tournamentId,
                athlete_id: userId
            });
            
        if (error && error.code !== '23505') { // Ignore unique constraint violation if already joined
            console.error("Join error:", error);
            alert("참가 처리 중 오류가 발생했습니다.");
            setJoinLoading(false);
            return;
        }
        
        setHasAccess(true);
        setJoinLoading(false);
    };

    const handleSaveSignature = async (finalSignatureDataUrl: string) => {
        if (!targetScorecardId) return;
        
        const supabase = createClient();
        const updateData: any = {};
        
        if (signatureType === 'player') {
            updateData.marker_signature = tempMarkerSignature;
            updateData.player_signature = finalSignatureDataUrl;
            updateData.player_signed_at = new Date().toISOString();
            updateData.marker_signed_at = new Date().toISOString();
        } else {
            updateData.referee_signature = finalSignatureDataUrl;
            updateData.referee_signed_at = new Date().toISOString();
        }
        
        const { error } = await supabase
            .from("scorecards")
            .update(updateData)
            .eq("id", targetScorecardId);
            
        if (error) {
            alert("서명 저장에 실패했습니다: " + error.message);
            return;
        }
        
        alert("서명이 완료되었습니다.");
        setShowSignatureModal(false);
        setTempMarkerSignature(null);
        
        // Refresh scorecards map
        const { data: updatedSc } = await supabase
            .from("scorecards")
            .select("id, athlete_id, marker_signature, player_signature, referee_signature")
            .eq("id", targetScorecardId)
            .single();
            
        if (updatedSc) {
            setScorecardsMap(prev => ({ ...prev, [updatedSc.athlete_id]: updatedSc }));
        }
    };

    // Sort leaderboard based on active tab
    const sortedLeaderboard = [...leaderboard].sort((a, b) => {
        if (activeTab === 'total') return a.total_score - b.total_score;
        
        // For SG tabs, higher is better (positive SG is good), so we sort descending.
        // If values are null, we put them at the bottom.
        const getVal = (item: any) => {
            switch(activeTab) {
                case 'tee': return item.rank_tee_shot;
                case 'second': return item.rank_second_shot;
                case 'around': return item.rank_around_green;
                case 'putting': return item.rank_putting;
                default: return null;
            }
        };
        const valA = getVal(a);
        const valB = getVal(b);
        if (valA === null && valB === null) return 0;
        if (valA === null) return 1;
        if (valB === null) return -1;
        return valB - valA; // Descending
    });

    if (loading || checkingAccess) {
        return (
            <div className="flex flex-col justify-center items-center h-64 gap-4">
                <Loader2 className="w-8 h-8 text-brand-navy animate-spin" />
                <p className="text-zinc-500 font-medium">대회 정보를 불러오는 중입니다...</p>
            </div>
        );
    }

    if (!hasAccess) {
        // 비밀번호 입력 모달 화면
        return (
            <div className="p-4 sm:p-8 max-w-xl mx-auto pb-24">
                <button
                    onClick={() => router.back()}
                    className="flex items-center gap-1 text-sm font-semibold text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 mb-6 transition-colors"
                >
                    <ChevronLeft size={16} />
                    목록으로 돌아가기
                </button>
                
                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[2rem] p-8 sm:p-10 shadow-sm text-center">
                    <div className="w-16 h-16 bg-brand-navy/10 rounded-full flex items-center justify-center mx-auto mb-6">
                        <KeyRound className="w-8 h-8 text-brand-navy" />
                    </div>
                    
                    <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-2">
                        {tournament?.name}
                    </h2>
                    <p className="text-sm text-zinc-500 mb-8">
                        이 대회에 참가하거나 리더보드를 보려면<br/>개설자가 설정한 비밀번호를 입력해주세요.
                    </p>
                    
                    <form onSubmit={handleJoin} className="max-w-xs mx-auto">
                        <div className="mb-4 text-left">
                            <label className="block text-xs font-semibold text-zinc-500 mb-1.5 ml-1">입장 비밀번호</label>
                            <input
                                type="password"
                                value={passwordInput}
                                onChange={(e) => setPasswordInput(e.target.value)}
                                placeholder="비밀번호 입력"
                                className="w-full px-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-brand-navy/50 transition-all text-center tracking-widest text-lg"
                                required
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={joinLoading}
                            className="w-full bg-brand-navy hover:bg-brand-navy-dark text-white px-6 py-3.5 rounded-xl font-bold text-base transition-all active:scale-[0.98] flex items-center justify-center gap-2 shadow-sm disabled:opacity-70"
                        >
                            {joinLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : "입장하기"}
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    // 접근 권한이 있을 경우 (참가 완료) - 리더보드 및 스코어 제출 화면
    return (
        <div className="p-4 sm:p-8 max-w-5xl mx-auto pb-24">
            <button
                onClick={() => router.push("/scores/tournaments")}
                className="flex items-center gap-1 text-sm font-semibold text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 mb-6 transition-colors"
            >
                <ChevronLeft size={16} />
                대회 목록
            </button>

            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 mb-8 shadow-sm">
                <div className="flex flex-wrap items-center gap-2 mb-3">
                    <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md ${
                        tournament?.status === '진행중' ? 'bg-brand-red text-white' :
                        tournament?.status === '준비중' ? 'bg-amber-500 text-white' :
                        'bg-zinc-200 text-zinc-500 dark:bg-zinc-700 dark:text-zinc-400'
                    }`}>
                        {tournament?.status}
                    </span>
                    <span className="bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md">
                        총 {tournament?.total_rounds}라운드
                    </span>
                </div>
                
                <h1 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-zinc-50 mb-4">
                    {tournament?.name}
                </h1>
                
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-zinc-500 dark:text-zinc-400 text-sm font-medium">
                    <div className="flex items-center gap-1.5">
                        <Calendar size={14} className="text-brand-navy opacity-70" />
                        <span>{tournament?.start_date?.slice(5).replace("-", ".")} ~ {tournament?.end_date?.slice(5).replace("-", ".")}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <MapPin size={14} className="text-brand-navy opacity-70" />
                        <span>{tournament?.location}</span>
                    </div>
                </div>
            </div>

            <div className="flex items-center justify-between mb-6">
                <PageTitle>리더보드</PageTitle>
                <Link
                    href={draftId ? `/scores/create?id=${draftId}&tournament_id=${tournamentId}` : `/scores/create?tournament_id=${tournamentId}`}
                    className="bg-brand-red hover:bg-brand-red-dark text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-sm active:scale-95 flex items-center gap-1.5"
                >
                    <Plus size={18} />
                    {draftId ? "작성 중인 스코어 이어하기" : "스코어 작성"}
                </Link>
            </div>

            {leaderboard.length === 0 ? (
                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-10 text-center text-zinc-500 shadow-sm">
                    <Trophy className="w-12 h-12 text-zinc-300 dark:text-zinc-700 mx-auto mb-4" />
                    <p>아직 제출된 스코어가 없습니다.</p>
                    <p className="text-sm mt-1">대회가 시작되고 스코어가 제출되면 실시간 리더보드가 표시됩니다.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {/* ── Category Tabs ── */}
                    <div className="flex overflow-x-auto scrollbar-hide gap-2 pb-2">
                        {[
                            { id: 'total', label: '종합' },
                            { id: 'tee', label: '티샷' },
                            { id: 'second', label: '세컨샷' },
                            { id: 'around', label: '그린주변' },
                            { id: 'putting', label: '퍼팅' }
                        ].map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as any)}
                                className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-colors border shadow-sm ${
                                    activeTab === tab.id 
                                        ? "bg-brand-navy border-brand-navy text-white" 
                                        : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                                }`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl overflow-hidden shadow-sm">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse min-w-[500px]">
                                <thead>
                                    <tr className="bg-zinc-50/50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-800 text-[11px] uppercase tracking-wider text-zinc-500 dark:text-zinc-400 font-bold">
                                        <th className="px-6 py-4 w-20 text-center">순위</th>
                                        <th className="px-6 py-4">선수명</th>
                                        <th className="px-6 py-4 text-center">Thru</th>
                                        <th className="px-6 py-4 text-right">
                                            {activeTab === 'total' ? 'Total' : 'SG'}
                                        </th>
                                        <th className="px-6 py-4 text-center">상태(서명)</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                                    {sortedLeaderboard.map((lb, index) => {
                                        // Calculate relative score assuming Par 72 for 18 holes (temporary logic, can be refined based on actual course data)
                                        const par = lb.thru_hole === 9 ? 36 : 72;
                                        const relativeScore = lb.total_score - par;
                                        const relativeText = relativeScore > 0 ? `+${relativeScore}` : relativeScore === 0 ? "E" : `${relativeScore}`;
                                        
                                        // SG text
                                        let sgVal = null;
                                        switch(activeTab) {
                                            case 'tee': sgVal = lb.rank_tee_shot; break;
                                            case 'second': sgVal = lb.rank_second_shot; break;
                                            case 'around': sgVal = lb.rank_around_green; break;
                                            case 'putting': sgVal = lb.rank_putting; break;
                                        }
                                        const sgText = sgVal !== null ? (sgVal > 0 ? `+${Number(sgVal).toFixed(2)}` : Number(sgVal).toFixed(2)) : "-";
                                        const sgColor = sgVal !== null ? (sgVal > 0 ? 'text-blue-500' : sgVal < 0 ? 'text-red-500' : 'text-zinc-600 dark:text-zinc-400') : 'text-zinc-300';
                                        
                                        // Signature Status
                                        const sc = scorecardsMap[lb.athlete?.id];
                                        const is18Completed = lb.thru_hole === 18;
                                        const hasPlayerSig = !!sc?.player_signature;
                                        const hasRefereeSig = !!sc?.referee_signature;
                                        const isFinalComplete = hasPlayerSig && hasRefereeSig;
                                        const isCoachOrAdmin = userRole === 'coach' || userRole === 'superadmin';
                                        const isOwnRow = userId === lb.athlete?.id;
                                    
                                    return (
                                        <tr 
                                            key={lb.id} 
                                            className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/50 transition-colors cursor-pointer group"
                                            onClick={() => setSelectedLiveScoreAthlete({ id: lb.athlete?.id, name: lb.athlete?.name || '알 수 없음' })}
                                        >
                                            <td className="px-6 py-4">
                                                <div className="flex justify-center items-center">
                                                    {index === 0 ? (
                                                        <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 font-black flex items-center justify-center text-sm shadow-sm border border-amber-200 dark:border-amber-800/50">
                                                            1
                                                        </div>
                                                    ) : index === 1 ? (
                                                        <div className="w-8 h-8 rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 font-black flex items-center justify-center text-sm shadow-sm border border-zinc-300 dark:border-zinc-700">
                                                            2
                                                        </div>
                                                    ) : index === 2 ? (
                                                        <div className="w-8 h-8 rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-500 font-black flex items-center justify-center text-sm shadow-sm border border-orange-200 dark:border-orange-800/50">
                                                            3
                                                        </div>
                                                    ) : (
                                                        <span className="text-zinc-500 font-semibold text-sm">
                                                            {index + 1}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 font-semibold text-zinc-900 dark:text-zinc-100 text-[15px] cursor-pointer" onClick={() => setSelectedLiveScoreAthlete({ id: lb.athlete?.id, name: lb.athlete?.name || '알 수 없음' })}>
                                                <span className="hover:underline">{lb.athlete?.name || "알 수 없음"}</span>
                                            </td>
                                            <td className="px-6 py-4 text-center cursor-pointer" onClick={() => setSelectedLiveScoreAthlete({ id: lb.athlete?.id, name: lb.athlete?.name || '알 수 없음' })}>
                                                {lb.thru_hole === 18 ? (
                                                    <span className="text-[11px] font-bold text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded">F</span>
                                                ) : (
                                                    <span className="text-sm font-semibold text-brand-navy">{lb.thru_hole}</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                {activeTab === 'total' ? (
                                                    <div className="flex flex-col items-end">
                                                        <span className={`text-lg font-black tracking-tight ${relativeScore < 0 ? 'text-red-500' : relativeScore > 0 ? 'text-blue-500' : 'text-zinc-900 dark:text-white'}`}>
                                                            {relativeText}
                                                        </span>
                                                        <span className="text-[10px] text-zinc-400 font-semibold">{lb.total_score}타</span>
                                                    </div>
                                                ) : (
                                                    <span className={`text-lg font-black tracking-tight ${sgColor}`}>
                                                        {sgText}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                {!is18Completed ? (
                                                    <span className="text-xs text-zinc-400 font-semibold">경기중</span>
                                                ) : isFinalComplete ? (
                                                    <span className="inline-flex items-center gap-1 text-xs font-bold text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30 px-2.5 py-1.5 rounded-lg border border-green-200 dark:border-green-800/50">
                                                        <CheckCircle2 size={14} /> 최종 완료
                                                    </span>
                                                ) : (
                                                    <div className="flex flex-col items-center gap-1.5">
                                                        {(!hasPlayerSig && isOwnRow) && (
                                                            <button 
                                                                onClick={(e) => { e.stopPropagation(); setTargetScorecardId(sc.id); setSignatureType('player'); setSignatureStep('marker'); setShowSignatureModal(true); }}
                                                                className="text-[11px] font-semibold bg-brand-navy text-white px-2.5 py-1.5 rounded-lg hover:bg-brand-navy/90 transition-colors shadow-sm whitespace-nowrap"
                                                            >
                                                                마커/선수 서명하기
                                                            </button>
                                                        )}
                                                        {(!hasPlayerSig && !isOwnRow) && (
                                                            <span className="text-[11px] text-zinc-400 font-semibold border border-zinc-200 dark:border-zinc-700 px-2 py-1 rounded-md">선수 서명 대기중</span>
                                                        )}
                                                        
                                                        {(hasPlayerSig && !hasRefereeSig && isCoachOrAdmin) && (
                                                            <button 
                                                                onClick={(e) => { e.stopPropagation(); setTargetScorecardId(sc.id); setSignatureType('referee'); setSignatureStep('referee'); setShowSignatureModal(true); }}
                                                                className="text-[11px] font-semibold bg-amber-500 text-white px-2.5 py-1.5 rounded-lg hover:bg-amber-600 transition-colors shadow-sm whitespace-nowrap"
                                                            >
                                                                경기위원 서명하기
                                                            </button>
                                                        )}
                                                        {(hasPlayerSig && !hasRefereeSig && !isCoachOrAdmin) && (
                                                            <span className="text-[11px] text-zinc-400 font-semibold border border-zinc-200 dark:border-zinc-700 px-2 py-1 rounded-md">경기위원 서명 대기중</span>
                                                        )}
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
                </div>
            )}
            
            {/* ── Live Score Modal ── */}
            {selectedLiveScoreAthlete && (
                <LiveScoreModal
                    isOpen={!!selectedLiveScoreAthlete}
                    onClose={() => setSelectedLiveScoreAthlete(null)}
                    tournamentId={tournamentId}
                    athleteId={selectedLiveScoreAthlete.id}
                    athleteName={selectedLiveScoreAthlete.name}
                />
            )}
            {/* ── Signature Modal ── */}
            {showSignatureModal && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="w-full max-w-lg bg-white dark:bg-zinc-900 rounded-[2rem] shadow-xl overflow-hidden p-6 relative">
                        {signatureStep === 'marker' ? (
                            <SignaturePad
                                title="마커 서명"
                                description="스코어카드에 이상이 없음을 확인합니다."
                                buttonText="다음 단계 (선수 서명)"
                                onSave={(data) => {
                                    setTempMarkerSignature(data);
                                    setSignatureStep('player');
                                }}
                                onCancel={() => { setShowSignatureModal(false); setTempMarkerSignature(null); }}
                            />
                        ) : signatureStep === 'player' ? (
                            <SignaturePad
                                title="선수 본인 서명"
                                description="본인의 스코어가 정확함을 확인합니다."
                                buttonText="서명 완료"
                                onSave={(data) => {
                                    handleSaveSignature(data);
                                }}
                                onCancel={() => {
                                    setSignatureStep('marker');
                                    setTempMarkerSignature(null);
                                }}
                            />
                        ) : (
                            <SignaturePad
                                title="경기위원 서명"
                                description="대회 스코어를 공식적으로 인증합니다."
                                buttonText="인증 완료"
                                onSave={(data) => {
                                    handleSaveSignature(data);
                                }}
                                onCancel={() => setShowSignatureModal(false)}
                            />
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
