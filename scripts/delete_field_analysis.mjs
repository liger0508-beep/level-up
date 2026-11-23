import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing supabase URL or KEY in .env.local");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function clean() {
    console.log("Checking records with type='analysis' and category='field'...");
    const { data: before, error: countErr } = await supabase
        .from("records")
        .select("id, title, content")
        .eq("type", "analysis")
        .eq("category", "field");

    if (countErr) {
        console.error("Error fetching records:", countErr.message);
        return;
    }

    console.log(`Found ${before?.length || 0} records to delete.`);
    if (!before || before.length === 0) {
        console.log("Nothing to delete.");
        return;
    }

    const { error: delErr } = await supabase
        .from("records")
        .delete()
        .eq("type", "analysis")
        .eq("category", "field");

    if (delErr) {
        console.error("Delete failed:", delErr.message);
    } else {
        console.log("Successfully deleted field analysis records!");
    }
}

clean();
