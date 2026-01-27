import { supabase } from './client';

export type Palette = {
  id: string;
  user_id: string | null;
  name: string;
  colors: string[];
  is_default: boolean;
  created_at: string;
};

export async function getPalettes(userId?: string): Promise<Palette[]> {
  let query = supabase
    .from('palettes')
    .select('*')
    .order('created_at', { ascending: false });

  if (userId) {
    query = query.or(`user_id.eq.${userId},is_default.eq.true`);
  } else {
    query = query.eq('is_default', true);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function createPalette(name: string, colors: string[], userId?: string): Promise<Palette> {
  const { data, error } = await supabase
    .from('palettes')
    .insert({
      name,
      colors,
      user_id: userId || null,
      is_default: false
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updatePalette(paletteId: string, updates: Partial<Palette>): Promise<void> {
  const { error } = await supabase
    .from('palettes')
    .update(updates)
    .eq('id', paletteId);

  if (error) throw error;
}

export async function deletePalette(paletteId: string): Promise<void> {
  const { error } = await supabase
    .from('palettes')
    .delete()
    .eq('id', paletteId);

  if (error) throw error;
}
