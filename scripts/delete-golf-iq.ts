import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

// Load .env.local
dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const supabase = createClient(supabaseUrl, supabaseKey)

async function deleteAllGolfIQ() {
    console.log('골프 IQ(course_management) 데이터 삭제를 시작합니다...');
    
    // records 테이블에서 type이 course_management인 모든 데이터를 삭제
    const { data, error } = await supabase
        .from('records')
        .delete()
        .eq('type', 'course_management')
        .select();
        
    if (error) {
        console.error('삭제 중 에러 발생:', error);
    } else {
        console.log(`성공적으로 삭제되었습니다! (총 ${data?.length || 0}개의 데이터 삭제됨)`);
    }
}

deleteAllGolfIQ();
