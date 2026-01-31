/**
 * src/lib/supabase/animation_tags.ts
 * -----------------------------------------------------------------------------
 * ## ANIMATION TAGS (Noob Guide)
 * 
 * Tags are like "Bookmarks" for your animation.
 * 
 * 1. SEGMENTS: You can label a range (e.g., frames 0 to 5 as "Idle").
 * 2. LOOPING: The app uses these to know which parts to play in a loop.
 * 
 * ## VAR TRACE
 * - `start_frame`: (Origin: Timeline) The first frame of the labeled sequence.
 * - `end_frame`: (Origin: Timeline) The last frame.
 * - `color`: (Origin: Tag Editor) The color of the label in the UI.
 */
import { supabase } from './client';

export type AnimationTag = {
  id: string;
  sprite_id: string;
  name: string;
  // ORIGIN: Timeline selection. USAGE: Loop start. PURPOSE: Defines sequence.
  start_frame: number;
  // ORIGIN: Timeline selection. USAGE: Loop end. PURPOSE: Defines sequence.
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
