import { createClient } from "./supabase/client";

export type VoteType = "all" | "coach" | "athlete" | "parent";
export type VoteStatus = "ongoing" | "closed";

export interface VoteOption {
    id: string;
    text: string;
    votes: number;
}

export interface Vote {
    id: string;
    type: VoteType;
    branch: string;
    status: VoteStatus;
    title: string;
    description: string;
    options: VoteOption[];
    startDate: string;
    endDate: string;
    author: string;
    authorId?: string;
    isImportant?: boolean;
    totalParticipants: number;
    createdAt?: string;
}

export const VOTE_TYPE_LABELS: Record<VoteType, string> = {
    all: "전체",
    coach: "코치",
    athlete: "선수",
    parent: "학부모",
};

export const VOTE_TYPE_COLORS: Record<VoteType, { bg: string; text: string; border: string }> = {
    all: { bg: "bg-indigo-50", text: "text-indigo-600", border: "border-indigo-100" },
    coach: { bg: "bg-blue-50", text: "text-blue-600", border: "border-blue-100" },
    athlete: { bg: "bg-emerald-50", text: "text-emerald-600", border: "border-emerald-100" },
    parent: { bg: "bg-amber-50", text: "text-amber-600", border: "border-amber-100" },
};

// ── Database Operations ──────────────────────────────────────

export async function getPolls() {
    const supabase = createClient();
    const { data, error } = await supabase
        .from("polls")
        .select(`
            *,
            users!polls_author_id_fkey (name)
        `)
        .order("created_at", { ascending: false });

    if (error) {
        console.error("Supabase fetching polls error:", error.message);
        throw error;
    }
    return (data || []).map(formatPollFromDb);
}

export async function getPollById(id: string) {
    const supabase = createClient();
    const { data, error } = await supabase
        .from("polls")
        .select(`
            *,
            users!polls_author_id_fkey (name)
        `)
        .eq("id", id)
        .single();

    if (error) {
        console.error(`Supabase fetching poll ${id} error:`, error.message);
        throw error;
    }
    return data ? formatPollFromDb(data) : null;
}

export async function savePoll(poll: Omit<Vote, "id" | "totalParticipants" | "author">) {
    const supabase = createClient();
    const { data, error } = await supabase
        .from("polls")
        .insert([{
            type: poll.type,
            branch: poll.branch,
            status: poll.status,
            title: poll.title,
            description: poll.description,
            options: poll.options,
            start_date: poll.startDate,
            end_date: poll.endDate,
            author_id: poll.authorId,
            is_important: poll.isImportant,
            total_participants: 0
        }])
        .select(`
            *,
            users!polls_author_id_fkey (name)
        `)
        .single();

    if (error) throw error;
    return formatPollFromDb(data);
}

export async function updatePoll(id: string, poll: Partial<Vote>) {
    const supabase = createClient();
    const updateData: any = {};
    if (poll.type) updateData.type = poll.type;
    if (poll.branch) updateData.branch = poll.branch;
    if (poll.status) updateData.status = poll.status;
    if (poll.title) updateData.title = poll.title;
    if (poll.description) updateData.description = poll.description;
    if (poll.options) updateData.options = poll.options;
    if (poll.startDate) updateData.start_date = poll.startDate;
    if (poll.endDate) updateData.end_date = poll.endDate;
    if (poll.author) updateData.author = poll.author;
    if (poll.isImportant !== undefined) updateData.is_important = poll.isImportant;

    const { data, error } = await supabase
        .from("polls")
        .update(updateData)
        .eq("id", id)
        .select()
        .single();

    if (error) throw error;
    return formatPollFromDb(data);
}

export async function deletePoll(id: string) {
    const supabase = createClient();
    const { error } = await supabase
        .from("polls")
        .delete()
        .eq("id", id);

    if (error) throw error;
}

export async function getPollVoters(pollId: string) {
    const supabase = createClient();
    const { data, error } = await supabase
        .from("poll_responses")
        .select(`
            option_id,
            user_id,
            users!poll_responses_user_id_fkey (name)
        `)
        .eq("poll_id", pollId);

    if (error) {
        console.error("Error fetching poll voters:", error.message);
        return [];
    }

    return (data || []).map((r: any) => ({
        optionId: r.option_id,
        userName: r.users?.name || "익명 사용자"
    }));
}

export async function castVote(pollId: string, optionId: string, userId: string) {
    const supabase = createClient();
    
    // 1. Check for existing vote
    const existingOptionId = await getUserVote(pollId, userId);
    
    if (existingOptionId === optionId) return; // No change

    // 2. Upsert into poll_responses
    const { error: responseError } = await supabase
        .from("poll_responses")
        .upsert([{
            poll_id: pollId,
            user_id: userId,
            option_id: optionId
        }], { onConflict: "poll_id,user_id" });

    if (responseError) throw responseError;

    // 3. Update the options JSONB votes
    const poll = await getPollById(pollId);
    if (!poll) return;

    const updatedOptions = poll.options.map(opt => {
        let newVotes = opt.votes;
        // Decrement old choice if it exists
        if (existingOptionId && opt.id === existingOptionId) {
            newVotes = Math.max(0, newVotes - 1);
        }
        // Increment new choice
        if (opt.id === optionId) {
            newVotes = newVotes + 1;
        }
        return { ...opt, votes: newVotes };
    });

    await updatePoll(pollId, { options: updatedOptions });
}

export async function getUserVote(pollId: string, userId: string) {
    const supabase = createClient();
    const { data, error } = await supabase
        .from("poll_responses")
        .select("option_id")
        .eq("poll_id", pollId)
        .eq("user_id", userId)
        .maybeSingle();

    if (error) throw error;
    return data?.option_id || null;
}

// ── Helper ──────────────────────────────────────────────────

function formatPollFromDb(dbPoll: any): Vote {
    return {
        id: dbPoll.id,
        type: dbPoll.type as VoteType,
        branch: dbPoll.branch,
        status: dbPoll.status as VoteStatus,
        title: dbPoll.title,
        description: dbPoll.description,
        options: dbPoll.options,
        startDate: dbPoll.start_date,
        endDate: dbPoll.end_date,
        author: dbPoll.users?.name || "알 수 없음",
        authorId: dbPoll.author_id,
        isImportant: dbPoll.is_important,
        totalParticipants: dbPoll.total_participants,
        createdAt: dbPoll.created_at
    };
}

// Keep mockVotes for reference/fallback if needed during dev
export const mockVotes: Vote[] = [
    {
        id: "v1",
        type: "all",
        branch: "전체",
        status: "ongoing",
        title: "아카데미 하계 캠프 장소 선정 투표",
        description: "2026년 하계 전지훈련 캠프 장소를 선정하기 위한 투표입니다. 여러분의 소중한 의견을 들려주세요.",
        options: [
            { id: "o1", text: "제주도 엘리시안 CC", votes: 45 },
            { id: "o2", text: "강원도 설악 썬밸리", votes: 32 },
            { id: "o3", text: "태국 치앙마이 하이랜드", votes: 58 },
        ],
        startDate: "2026-03-05",
        endDate: "2026-03-15",
        author: "운영팀",
        isImportant: true,
        totalParticipants: 135,
    }
];
