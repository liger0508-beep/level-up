import { createClient } from "./supabase/client";

export interface TrainingTemplate {
    id: string;
    categoryId: string;
    title: string;
    description: string;
    purpose?: string;
    goal?: string;
    mediaUrl?: string;
    mediaType?: string;
}

/**
 * Fetches training templates (presets) from the 'training_templates' table.
 */
export async function fetchTrainingTemplates(category: string = "all"): Promise<TrainingTemplate[]> {
    const supabase = createClient();
    let query = supabase
        .from('training_templates')
        .select('*')
        .order('created_at', { ascending: false });

    if (category !== "all") {
        query = query.eq('categoryId', category);
    }

    const { data, error } = await query;

    if (error) {
        console.error("Error fetching training templates:", error);
        return [];
    }

    return data || [];
}

/**
 * Saves or updates a training template.
 */
export async function saveTrainingTemplate(template: Omit<TrainingTemplate, 'id'> & { id?: string }): Promise<{ data: any; error: any }> {
    const supabase = createClient();

    if (template.id && !template.id.startsWith('tr_')) {
        // Update existing
        return await supabase
            .from('training_templates')
            .update({
                categoryId: template.categoryId,
                title: template.title,
                description: template.description,
                purpose: template.purpose,
                goal: template.goal,
                mediaUrl: template.mediaUrl,
                mediaType: template.mediaType
            })
            .eq('id', template.id)
            .select()
            .single();
    } else {
        // Insert new
        // Remove temporary ID prefix if it exists
        const { id, ...rest } = template;
        return await supabase
            .from('training_templates')
            .insert([rest])
            .select()
            .single();
    }
}

/**
 * Deletes a training template.
 */
export async function deleteTrainingTemplate(id: string): Promise<{ error: any }> {
    const supabase = createClient();
    return await supabase
        .from('training_templates')
        .delete()
        .eq('id', id);
}
