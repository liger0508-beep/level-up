"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

export function UserActivityTracker() {
    useEffect(() => {
        const trackActivity = async () => {
            try {
                // Get KST date string (YYYY-MM-DD)
                const now = new Date();
                const kstTime = new Date(now.getTime() + 9 * 60 * 60 * 1000);
                const todayKST = kstTime.toISOString().split("T")[0];

                const lastVisitDate = localStorage.getItem("last_visit_date");
                
                // If already tracked today, do nothing
                if (lastVisitDate === todayKST) {
                    return;
                }

                const supabase = createClient();
                const { data: { user } } = await supabase.auth.getUser();

                if (user) {
                    // Log the visit to user_activity_logs
                    const { error } = await supabase.from("user_activity_logs").insert([
                        { user_id: user.id, activity_type: "login" }
                    ]);

                    if (!error) {
                        localStorage.setItem("last_visit_date", todayKST);
                    }
                }
            } catch (err) {
                console.error("Failed to track user activity:", err);
            }
        };

        trackActivity();
    }, []);

    return null; // This component doesn't render anything
}
