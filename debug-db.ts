import { createClient } from "@supabase/supabase-js";

const url = "https://wdminjjyehtlsddrwhqy.supabase.co";
const key = "sb_publishable_kQLxgFJtAxuIkfGp_4qgNw_btIFduP5";

async function checkTable() {
    const supabase = createClient(url, key);
    
    console.log("Checking tournament_results table...");
    const { data, error } = await supabase
        .from('tournament_results')
        .select('*')
        .limit(1);

    if (error) {
        console.error("DETAILED ERROR:", JSON.stringify(error, null, 2));
    } else {
        console.log("TABLE EXISTS, DATA:", data);
    }
}

checkTable();
