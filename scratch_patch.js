const fs = require('fs');
const file = 'd:/gla_coach/src/app/(main)/consultations/create/page.tsx';
let content = fs.readFileSync(file, 'utf8');

const target1 = `    // Initialize athleteName from searchParams
    useEffect(() => {
        const player = searchParams.get("player");
        if (player) {
            setAthleteName(player);
        }
    }, [searchParams]);`;

const replacement1 = `    // Initialize athleteName from searchParams
    useEffect(() => {
        const player = searchParams.get("player");
        if (player) {
            setAthleteName(player);
        } else {
            const saved = sessionStorage.getItem("draftConsultationAthlete");
            if (saved) {
                setAthleteName(saved);
            }
        }
    }, [searchParams]);

    useEffect(() => {
        if (athleteName) {
            sessionStorage.setItem("draftConsultationAthlete", athleteName);
        } else {
            sessionStorage.removeItem("draftConsultationAthlete");
        }
    }, [athleteName]);`;

content = content.replace(target1.replace(/\r\n/g, '\n'), replacement1);
content = content.replace(target1, replacement1);

const target2 = `            alert("상담 일지가 등록되었습니다.");
            router.push("/consultations");`;
const replacement2 = `            alert("상담 일지가 등록되었습니다.");
            sessionStorage.removeItem("draftConsultationAthlete");
            router.push("/consultations");`;

content = content.replace(target2.replace(/\r\n/g, '\n'), replacement2);
content = content.replace(target2, replacement2);

fs.writeFileSync(file, content, 'utf8');
console.log('done');
