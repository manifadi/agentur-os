import { supabase } from '../supabaseClient';

export const uploadFileToSupabase = async (file: File, bucket: string): Promise<string> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
    const { error: uploadError } = await supabase.storage.from(bucket).upload(fileName, file);
    if (uploadError) throw uploadError;
    const { data } = supabase.storage.from(bucket).getPublicUrl(fileName);
    return data.publicUrl;
};

export const deleteFileFromSupabase = async (fullUrl: string, bucket: string): Promise<void> => {
    if (!fullUrl) return;
    try {
        const fileName = fullUrl.split('/').pop();
        if (fileName) await supabase.storage.from(bucket).remove([fileName]);
    } catch (e) {
        console.warn(e);
    }
};
