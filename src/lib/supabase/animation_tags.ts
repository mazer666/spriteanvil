import { supabase } from './client';

export type AnimationTag = {
  id: string;
  sprite_id: string;
  name: string;
  start_frame: number;
  end_frame: number;
  color: string;
  created_at: string;
};

export async function getAnimationTags(spriteId: string): Promise<AnimationTag[]> {
  const { data, error } = await supabase
    .from('animation_tags')
    .select('*')
    .eq('sprite_id', spriteId)
    .order('start_frame', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function createAnimationTag(tag: Omit<AnimationTag, 'id' | 'created_at'>): Promise<AnimationTag> {
  const { data, error } = await supabase
    .from('animation_tags')
    .insert(tag)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateAnimationTag(tagId: string, updates: Partial<AnimationTag>): Promise<void> {
  const { error } = await supabase
    .from('animation_tags')
    .update(updates)
    .eq('id', tagId);

  if (error) throw error;
}

export async function deleteAnimationTag(tagId: string): Promise<void> {
  const { error } = await supabase
    .from('animation_tags')
    .delete()
    .eq('id', tagId);

  if (error) throw error;
}
