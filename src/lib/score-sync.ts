
export interface ScoreData {
    id: string;
    score: number;
    title: string;
    playerName: string;
    coachName: string;
    courseName: string;
    comment: string;
    date: string;
}

export const mockScores: ScoreData[] = [
    {
        id: "1",
        score: 68,
        title: "2026 윈터 클래식 1R",
        playerName: "김민수",
        coachName: "최코치",
        courseName: "베어크리크 CC",
        comment: "전반적으로 샷감이 매우 좋았으나 3번 홀에서 3펏이 아쉬웠습니다. 후반 집중력이 돋보였습니다.",
        date: "2026-03-07",
    },
    {
        id: "2",
        score: 72,
        playerName: "이수진",
        title: "정기 평가 라운드",
        coachName: "박코치",
        courseName: "솔트베이 CC",
        comment: "기복 없는 안정적인 경기 운영을 보여주었습니다. 파 세이브 능력이 향상되었습니다.",
        date: "2026-03-06",
    },
    {
        id: "3",
        score: 75,
        playerName: "박현우",
        title: "주말 연습 라운드",
        coachName: "최코치",
        courseName: "아일랜드 CC",
        comment: "러프에서의 탈출이 다소 아쉬웠으나 장타를 활용한 공략이 유효했습니다.",
        date: "2026-03-05",
    },
    {
        id: "4",
        score: 71,
        playerName: "정세민",
        title: "2월 국가대표 선발전",
        coachName: "최코치",
        courseName: "남서울 CC",
        comment: "퍼팅 거리감이 완벽했습니다. 핀 위치에 따른 공략이 잘 이루어졌습니다.",
        date: "2026-03-04",
    },
    {
        id: "5",
        score: 80,
        playerName: "김민수",
        title: "연습 전반 9홀",
        coachName: "최코치",
        courseName: "베어크리크 CC",
        comment: "체력적인 부담으로 후반에 집중력이 흐트러진 점을 보완해야 합니다.",
        date: "2026-03-03",
    },
];

export async function fetchLatestScoreByPlayer(playerName: string): Promise<ScoreData | null> {
    const playerScores = mockScores.filter(s => s.playerName === playerName);
    if (playerScores.length === 0) return null;
    return playerScores.sort((a, b) => b.date.localeCompare(a.date))[0];
}
