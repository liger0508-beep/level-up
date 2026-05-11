import { createClient } from "./supabase/client";
import { LessonType } from "@/components/lesson/LessonCard";

export interface LessonTemplate {
    id: string;
    categoryId: string;
    title: string;
    description: string;
    imageUrl: string;
}

/**
 * Fetches lesson templates (presets) from the 'lesson_templates' table.
 */
export async function fetchLessonTemplates(category: string = "all"): Promise<LessonTemplate[]> {
    const supabase = createClient();
    let query = supabase
        .from('lesson_templates')
        .select('*')
        .order('created_at', { ascending: false });

    if (category !== "all") {
        query = query.eq('categoryId', category);
    }

    const { data, error } = await query;

    if (error) {
        console.error("Error fetching lesson templates:", error);
        return [];
    }

    return data || [];
}

/**
 * Saves or updates a lesson template.
 */
export async function saveLessonTemplate(template: Omit<LessonTemplate, 'id'> & { id?: string }): Promise<{ data: any; error: any }> {
    const supabase = createClient();

    if (template.id && !template.id.startsWith('t_')) {
        // Update existing
        return await supabase
            .from('lesson_templates')
            .update({
                categoryId: template.categoryId,
                title: template.title,
                description: template.description,
                imageUrl: template.imageUrl
            })
            .eq('id', template.id)
            .select()
            .single();
    } else {
        // Insert new
        // Remove temporary ID prefix if it exists
        const { id, ...rest } = template;
        return await supabase
            .from('lesson_templates')
            .insert([rest])
            .select()
            .single();
    }
}

/**
 * Deletes a lesson template.
 */
export async function deleteLessonTemplate(id: string): Promise<{ error: any }> {
    const supabase = createClient();
    return await supabase
        .from('lesson_templates')
        .delete()
        .eq('id', id);
}
