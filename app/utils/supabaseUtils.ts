import { supabase } from '../supabaseClient';

// Ermittelt den Organisations-Prefix des aktuellen Users für Storage-Pfade.
// Dateien werden unter `<organization_id>/<datei>` abgelegt, damit eine spätere
// pfadbasierte Storage-RLS Mandanten sauber trennen kann.
async function orgPrefix(): Promise<string> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return '';
    const { data: emp } = await supabase
        .from('employees')
        .select('organization_id')
        .eq('user_id', user.id)
        .maybeSingle();
    return emp?.organization_id ? `${emp.organization_id}/` : '';
}

export const uploadFileToSupabase = async (file: File, bucket: string): Promise<string> => {
    const fileExt = file.name.split('.').pop();
    const rand = `${Math.random().toString(36).substring(2)}.${fileExt}`;
    const path = `${await orgPrefix()}${rand}`;
    const { error: uploadError } = await supabase.storage.from(bucket).upload(path, file);
    if (uploadError) throw uploadError;
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    return data.publicUrl;
};

export const deleteFileFromSupabase = async (fullUrl: string, bucket: string): Promise<void> => {
    if (!fullUrl) return;
    try {
        // Objekt-Pfad ist alles nach `/<bucket>/` — funktioniert für alte (flache)
        // und neue (org-prefixed) Dateien.
        const marker = `/${bucket}/`;
        const idx = fullUrl.indexOf(marker);
        const path = idx >= 0 ? fullUrl.slice(idx + marker.length).split('?')[0] : fullUrl.split('/').pop();
        if (path) await supabase.storage.from(bucket).remove([decodeURIComponent(path)]);
    } catch (e) {
        console.warn(e);
    }
};
