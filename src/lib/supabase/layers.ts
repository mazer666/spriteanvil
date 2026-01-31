/**
 * src/lib/supabase/layers.ts
 * -----------------------------------------------------------------------------
 * ## LAYER STORAGE (Noob Guide)
 * 
 * This file handles saving individual "Transparent Sheets".
 * 
 * 1. ATTRIBUTES: We save things like opacity (how see-through) and 
 *    blend mode (how colors mix).
 * 2. INDEX: The `layer_index` tells us which sheet is on bottom and 
 *    which is on top.
 * 
 * ## VAR TRACE
 * - `opacity`: (Origin: LayerPanel) Number from 0.0 to 1.0.
 * - `blend_mode`: (Origin: Dropdown) "normal", "multiply", etc.
 * - `pixel_data`: (Origin: frames.ts) The Base64 string of the art.
 */
import { supabase } from './client';

export type Layer = {
  id: string;
  frame_id: string;
  // ORIGIN: Layer List. USAGE: Determines drawing order. PURPOSE: Z-index.
  layer_index: number;
  name: string;
  pixel_data: string;
  opacity: number;
  blend_mode: 'normal' | 'multiply' | 'screen' | 'overlay' | 'add' | 'subtract' | 'darken' | 'lighten' | 'difference' | 'exclusion';
  is_visible: boolean;
  is_locked: boolean;
  created_at: string;
};

export async function getLayersForFrame(frameId: string): Promise<Layer[]> {
  const { data, error } = await supabase
    .from('layers')
    .select('*')
    .eq('frame_id', frameId)
    .order('layer_index', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function createLayer(frameId: string, layerIndex: number, name: string, pixelData: string): Promise<Layer> {
  const { data, error } = await supabase
    .from('layers')
    .insert({
      frame_id: frameId,
      layer_index: layerIndex,
      name,
      pixel_data: pixelData,
      opacity: 1.0,
      blend_mode: 'normal',
      is_visible: true,
      is_locked: false
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateLayer(layerId: string, updates: Partial<Layer>): Promise<void> {
  const { error } = await supabase
    .from('layers')
    .update(updates)
    .eq('id', layerId);

  if (error) throw error;
}

export async function deleteLayer(layerId: string): Promise<void> {
  const { error } = await supabase
    .from('layers')
    .delete()
    .eq('id', layerId);

  if (error) throw error;
}

export async function reorderLayers(frameId: string, newOrder: { id: string; layer_index: number }[]): Promise<void> {
  for (const item of newOrder) {
    await supabase
      .from('layers')
      .update({ layer_index: item.layer_index })
      .eq('id', item.id);
  }
}
