"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Trophy, Calendar, MapPin, Lock, ChevronLeft, Loader2, KeyRound, Plus, FileSignature, CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { PageTitle } from "@/components/ui/Typography";
import { LiveScoreModal } from "@/components/ui/LiveScoreModal";
import { CrossCheckSignatureModal } from "@/components/ui/CrossCheckSignatureModal";
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
    const [leaderboardTab, setLeaderboardTab] = useState<'live' | 'pending'>('live');

    // Category & Live Score State
    const [selectedLiveScoreAthlete, setSelectedLiveScoreAthlete] = useState<{id: string, name: string} | null>(null);
    const [selectedCrossCheckAthlete, setSelectedCrossCheckAthlete] = useState<{id: string, name: string, scorecardId: string} | null>(null);

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
                .select("id, athlete_id, marker_id, marker_signature, player_signature, referee_signature")
                .eq("tournament_id", tournamentId)
                .eq("is_final", true);
                
            if (scData) {
                const map: Record<string, any> = {};
                scData.forEach(sc => {
                    const targetId = sc.marker_id || sc.athlete_id;
                    if (targetId) {
                        map[targetId] = sc;
                    }
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

    const handleCancelPlayerSignature = async (scorecardId: string, athleteId: string) => {
        try {
            const supabase = createClient();
            const { error } = await supabase
                .from("scorecards")
                .update({ 
                    player_signature: null,
                    player_signed_at: null
                })
                .eq("id", scorecardId);

            if (error) {
                console.error("선수 서명 취소 오류:", error);
                alert("선수 서명 취소에 실패했습니다.");
                return;
            }

            alert("선수 서명이 취소되었습니다.");
            
            setScorecardsMap(prev => ({
                ...prev,
                [athleteId]: {
                    ...prev[athleteId],
                    player_signature: null,
                }
            }));

        } catch (err) {
            console.error(err);
            alert("오류가 발생했습니다.");
        }
    };

    const handleDeleteTournament = async () => {
        if (!window.confirm("정말 이 대회를 삭제하시겠습니까? 관련 데이터가 모두 삭제될 수 있습니다.")) return;
        
        const supabase = createClient();
        const { error } = await supabase.from("score_tournaments").delete().eq("id", tournamentId);
        
        if (error) {
            alert("삭제 중 오류가 발생했습니다.");
            console.error(error);
        } else {
            alert("대회가 삭제되었습니다.");
            router.push("/scores/tournaments");
        }
    };

    // Filter and Sort leaderboard
    const displayLeaderboard = [...leaderboard]
        .filter(lb => {
            if (leaderboardTab === 'live') return true;
            // 'pending' 탭: 18홀을 마쳤으나 아직 선수 또는 경기위원 서명이 완료되지 않은 경우
            const sc = scorecardsMap[lb.athlete?.id];
            const hasPlayerSig = !!sc?.player_signature;
            const hasRefereeSig = !!sc?.referee_signature;
            return lb.thru_hole === 18 && (!hasPlayerSig || !hasRefereeSig);
        })
        .sort((a, b) => a.total_score - b.total_score);
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

            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 mb-8 shadow-sm relative">
                
                {/* 우측 상단 수정/삭제 버튼 */}
                {(userRole === 'admin' || userRole === 'superadmin' || tournament?.created_by === userId) && (
                    <div className="absolute top-6 right-6 flex items-center gap-2">
                        <Link
                            href={`/scores/tournaments/${tournamentId}/edit`}
                            className="px-3 py-1.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg text-xs font-semibold transition-colors"
                        >
                            수정
                        </Link>
                        <button
                            onClick={handleDeleteTournament}
                            className="px-3 py-1.5 bg-red-50 text-red-500 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 rounded-lg text-xs font-semibold transition-colors"
                        >
                            삭제
                        </button>
                    </div>
                )}

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
                
                <h1 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-zinc-50 mb-4 pr-24">
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

            {/* ── Tabs ── */}
            <div className="flex overflow-x-auto scrollbar-hide gap-2 mb-4 pb-2">
                <button
                    onClick={() => setLeaderboardTab('live')}
                    className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-colors border shadow-sm ${
                        leaderboardTab === 'live' 
                            ? "bg-brand-navy border-brand-navy text-white" 
                            : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                    }`}
                >
                    LIVE
                </button>
                <button
                    onClick={() => setLeaderboardTab('pending')}
                    className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-colors border shadow-sm ${
                        leaderboardTab === 'pending' 
                            ? "bg-brand-navy border-brand-navy text-white" 
                            : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                    }`}
                >
                    서명 대기
                </button>
            </div>

            {leaderboard.length === 0 ? (
                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-10 text-center text-zinc-500 shadow-sm">
                    <Trophy className="w-12 h-12 text-zinc-300 dark:text-zinc-700 mx-auto mb-4" />
                    <p>아직 제출된 스코어가 없습니다.</p>
                    <p className="text-sm mt-1">대회가 시작되고 스코어가 제출되면 실시간 리더보드가 표시됩니다.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl overflow-hidden shadow-sm">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse min-w-full">
                                <thead>
                                    <tr className="bg-zinc-50/50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-800 text-[11px] uppercase tracking-wider text-zinc-500 dark:text-zinc-400 font-bold">
                                        <th className="px-2 sm:px-6 py-4 w-12 sm:w-20 text-center whitespace-nowrap">순위</th>
                                        <th className="px-2 sm:px-6 py-4 text-center whitespace-nowrap">선수명</th>
                                        {leaderboardTab === 'live' && (
                                            <th className="px-2 sm:px-6 py-4 text-center whitespace-nowrap">Thru</th>
                                        )}
                                        <th className="px-2 sm:px-6 py-4 text-center whitespace-nowrap">Total</th>
                                        {leaderboardTab === 'pending' && (
                                            <th className="px-2 sm:px-6 py-4 text-center whitespace-nowrap">상태</th>
                                        )}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                                    {displayLeaderboard.map((lb, index) => {
                                        // Calculate relative score assuming Par 72 for 18 holes (temporary logic, can be refined based on actual course data)
                                        const par = lb.thru_hole === 9 ? 36 : 72;
                                        const relativeScore = lb.total_score - par;
                                        const relativeText = relativeScore > 0 ? `+${relativeScore}` : relativeScore === 0 ? "E" : `${relativeScore}`;
                                        
                                        // Signature Status
                                        const sc = scorecardsMap[lb.athlete?.id];
                                        const is18Completed = lb.thru_hole === 18;
                                        const hasPlayerSig = !!sc?.player_signature;
                                        const hasRefereeSig = !!sc?.referee_signature;
                                        const isFinalComplete = hasPlayerSig && hasRefereeSig;
                                        const isCoachOrAdmin = userRole === 'coach' || userRole === 'admin' || userRole === 'superadmin';
                                        const isOwnRow = userId === lb.athlete?.id;
                                    
                                    return (
                                        <tr 
                                            key={lb.id} 
                                            tabIndex={0}
                                            className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/50 transition-colors group relative outline-none"
                                        >
                                            <td className="px-2 sm:px-6 py-4">
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
                                            <td className="px-2 sm:px-6 py-4 font-semibold text-zinc-900 dark:text-zinc-100 text-[14px] sm:text-[15px] cursor-pointer text-center" onClick={() => setSelectedLiveScoreAthlete({ id: lb.athlete?.id, name: lb.athlete?.name || '알 수 없음' })}>
                                                <span className="hover:underline">{lb.athlete?.name || "알 수 없음"}</span>
                                            </td>
                                            {leaderboardTab === 'live' && (
                                                <td className="px-2 sm:px-6 py-4 text-center cursor-pointer" onClick={() => setSelectedLiveScoreAthlete({ id: lb.athlete?.id, name: lb.athlete?.name || '알 수 없음' })}>
                                                    {lb.thru_hole === 18 ? (
                                                        <span className="text-[11px] font-bold text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded">F</span>
                                                    ) : (
                                                        <span className="text-sm font-semibold text-brand-navy">{lb.thru_hole}</span>
                                                    )}
                                                </td>
                                            )}
                                            <td className="px-2 sm:px-6 py-4 text-center">
                                                <div className="flex flex-col items-center">
                                                    <span className={`text-lg font-black tracking-tight ${relativeScore < 0 ? 'text-red-500' : relativeScore > 0 ? 'text-blue-500' : 'text-zinc-900 dark:text-white'}`}>
                                                        {relativeText}
                                                    </span>
                                                    <span className="text-[10px] text-zinc-400 font-semibold">{lb.total_score}타</span>
                                                </div>
                                            </td>
                                            {leaderboardTab === 'pending' && (
                                                <td className="px-2 sm:px-6 py-4 text-center">
                                                    <div className="flex flex-col gap-2 items-center justify-center">
                                                        {hasPlayerSig ? (
                                                            <>
                                                                {/* 1. Player Signature (Top) */}
                                                                {((isOwnRow || isCoachOrAdmin) && !hasRefereeSig) ? (
                                                                    <button 
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            if (window.confirm("선수 서명을 취소하시겠습니까?")) {
                                                                                handleCancelPlayerSignature(sc.id, lb.athlete?.id);
                                                                            }
                                                                        }}
                                                                        className="text-[11px] font-semibold text-brand-navy bg-brand-navy/10 hover:bg-brand-navy/20 dark:text-brand-navy-light dark:bg-brand-navy/20 dark:hover:bg-brand-navy/30 transition-colors px-2 py-1.5 rounded-lg w-full max-w-[120px]"
                                                                    >
                                                                        선수 서명 완료 (취소)
                                                                    </button>
                                                                ) : (
                                                                    <span className="text-[11px] font-semibold text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-2 py-1.5 rounded-lg w-full max-w-[120px]">선수 서명 완료</span>
                                                                )}

                                                                {/* 2. Referee Signature (Bottom) */}
                                                                {hasRefereeSig ? (
                                                                    <span className="text-[11px] font-semibold text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-2 py-1.5 rounded-lg w-full max-w-[120px]">경기위원 서명 완료</span>
                                                                ) : isCoachOrAdmin ? (
                                                                    <button 
                                                                        onClick={(e) => { 
                                                                            e.stopPropagation(); 
                                                                            if (sc) {
                                                                                setTargetScorecardId(sc.id); setSignatureType('referee'); setSignatureStep('referee'); setShowSignatureModal(true); 
                                                                            }
                                                                        }}
                                                                        className="text-[11px] font-bold bg-amber-500 text-white px-2 py-1.5 rounded-lg shadow-sm hover:bg-amber-600 transition-colors w-full max-w-[120px]"
                                                                    >
                                                                        경기위원 서명
                                                                    </button>
                                                                ) : (
                                                                    <span className="text-[11px] text-zinc-400 font-semibold border border-zinc-200 dark:border-zinc-700 px-2 py-1.5 rounded-lg bg-white dark:bg-zinc-800 w-full max-w-[120px]">경기위원 대기중</span>
                                                                )}
                                                            </>
                                                        ) : (
                                                            <>
                                                                {/* 1. Marker Signature (Top) */}
                                                                <span className="text-[11px] font-semibold text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-2 py-1.5 rounded-lg w-full max-w-[120px]">마커 서명 완료</span>
                                                                
                                                                {/* 2. Player Signature (Bottom) */}
                                                                {(isOwnRow || isCoachOrAdmin) ? (
                                                                    <button 
                                                                        onClick={(e) => { 
                                                                            e.stopPropagation(); 
                                                                            if (sc) {
                                                                                setSelectedCrossCheckAthlete({ id: lb.athlete?.id, name: lb.athlete?.name || '알 수 없음', scorecardId: sc.id });
                                                                            } else {
                                                                                alert('공식 스코어카드를 찾을 수 없습니다.');
                                                                            }
                                                                        }}
                                                                        className="text-[11px] font-bold bg-brand-navy text-white px-2 py-1.5 rounded-lg shadow-sm hover:bg-brand-navy/90 transition-colors w-full max-w-[120px]"
                                                                    >
                                                                        선수 서명 (체크)
                                                                    </button>
                                                                ) : (
                                                                    <span className="text-[11px] text-zinc-400 font-semibold border border-zinc-200 dark:border-zinc-700 px-2 py-1.5 rounded-lg bg-white dark:bg-zinc-800 w-full max-w-[120px]">선수 대기중</span>
                                                                )}
                                                            </>
                                                        )}
                                                    </div>
                                                </td>
                                            )}
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

            {/* ── Cross Check Modal ── */}
            {selectedCrossCheckAthlete && (
                <CrossCheckSignatureModal
                    isOpen={!!selectedCrossCheckAthlete}
                    onClose={() => setSelectedCrossCheckAthlete(null)}
                    tournamentId={tournamentId}
                    athleteId={selectedCrossCheckAthlete.id}
                    athleteName={selectedCrossCheckAthlete.name}
                    scorecardId={selectedCrossCheckAthlete.scorecardId}
                    hasPlayerSig={!!scorecardsMap[selectedCrossCheckAthlete.id]?.player_signature}
                    hasMarkerSig={true}
                    onSignAsPlayer={() => {
                        setSelectedCrossCheckAthlete(null);
                        setTargetScorecardId(selectedCrossCheckAthlete.scorecardId);
                        setSignatureType('player');
                        setSignatureStep('player'); // 마커 서명 스킵하고 선수 서명으로 직행
                        setShowSignatureModal(true);
                    }}
                    onCancelMarkerSig={() => {
                        setSelectedCrossCheckAthlete(null);
                        router.push(`/scores/create?id=${selectedCrossCheckAthlete.scorecardId}&tournament_id=${tournamentId}`);
                    }}
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
