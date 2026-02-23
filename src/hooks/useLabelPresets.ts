import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { LabelSettings, defaultLabelSettings } from '@/types/rental';
import { useAuth } from '@/hooks/useAuth';

export interface LabelPreset {
  id: string;
  name: string;
  settings: LabelSettings;
  logo_url: string | null;
  is_default: boolean;
}

export function useLabelPresets() {
  const { user } = useAuth();
  const [presets, setPresets] = useState<LabelPreset[]>([]);
  const [loading, setLoading] = useState(false);
  const [activePreset, setActivePreset] = useState<LabelPreset | null>(null);

  const fetchPresets = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from('label_presets')
      .select('*')
      .eq('user_id', user.id)
      .order('is_default', { ascending: false });

    const mapped: LabelPreset[] = (data || []).map((row: any) => ({
      id: row.id,
      name: row.name,
      settings: row.settings as LabelSettings,
      logo_url: row.logo_url,
      is_default: row.is_default,
    }));
    setPresets(mapped);
    // Auto-select default or first
    const def = mapped.find((p) => p.is_default) || mapped[0];
    if (def && !activePreset) setActivePreset(def);
    setLoading(false);
  };

  useEffect(() => {
    fetchPresets();
  }, [user]);

  const savePreset = async (name: string, settings: LabelSettings, logoUrl?: string | null) => {
    if (!user) return;
    const existing = presets.find((p) => p.name === name);
    if (existing) {
      await supabase
        .from('label_presets')
        .update({ settings: settings as any, logo_url: logoUrl ?? existing.logo_url })
        .eq('id', existing.id);
    } else {
      await supabase.from('label_presets').insert({
        user_id: user.id,
        name,
        settings: settings as any,
        logo_url: logoUrl || null,
        is_default: presets.length === 0,
      });
    }
    await fetchPresets();
  };

  const deletePreset = async (id: string) => {
    await supabase.from('label_presets').delete().eq('id', id);
    if (activePreset?.id === id) setActivePreset(null);
    await fetchPresets();
  };

  const uploadLogo = async (file: File): Promise<string | null> => {
    if (!user) return null;
    const ext = file.name.split('.').pop();
    const path = `${user.id}/logo-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('logos').upload(path, file, { upsert: true });
    if (error) return null;
    const { data } = supabase.storage.from('logos').getPublicUrl(path);
    return data.publicUrl;
  };

  return { presets, loading, activePreset, setActivePreset, savePreset, deletePreset, uploadLogo, refetch: fetchPresets };
}
