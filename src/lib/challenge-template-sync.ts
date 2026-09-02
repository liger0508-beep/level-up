import { createClient } from "./supabase/client";

export interface ChallengeTemplate {
    id: string;
    categoryId: string;
    title: string;
    description: string;
    purpose?: string;
    goal?: string;
    mediaUrl?: string;
    mediaType?: string;
    /** Scoring configuration for this challenge (JSON) */
    scoring_config?: any;
    /** Order for display in the challenge list */
    sort_order?: number;
}

/**
 * Fetches challenge templates (content presets) from the 'challenge_templates' table.
 */
export async function fetchChallengeTemplates(category: string = "all"): Promise<ChallengeTemplate[]> {
    const supabase = createClient();
    let query = supabase
        .from('challenge_templates')
        .select('*')
        .order('sort_order', { ascending: true });

    if (category !== "all") {
        query = query.eq('categoryId', category);
    }

    const { data, error } = await query;

    if (error) {
        console.error("Error fetching challenge templates:", error);
        return [];
    }

    return data || [];
}

/**
 * Saves or updates a challenge template.
 */
export async function saveChallengeTemplate(template: Omit<ChallengeTemplate, 'id'> & { id?: string }): Promise<{ data: any; error: any }> {
    const supabase = createClient();

    if (template.id) {
        // Update existing
        return await supabase
            .from('challenge_templates')
            .update({
                categoryId: template.categoryId,
                title: template.title,
                description: template.description,
                purpose: template.purpose,
                goal: template.goal,
                mediaUrl: template.mediaUrl,
                mediaType: template.mediaType,
                scoring_config: template.scoring_config,
                sort_order: template.sort_order,
            })
            .eq('id', template.id)
            .select()
            .single();
    } else {
        // Insert new
        const { id, ...rest } = template;
        return await supabase
            .from('challenge_templates')
            .insert([rest])
            .select()
            .single();
    }
}

/**
 * Deletes a challenge template.
 */
export async function deleteChallengeTemplate(id: string): Promise<{ error: any }> {
    const supabase = createClient();
    return await supabase
        .from('challenge_templates')
        .delete()
        .eq('id', id);
}