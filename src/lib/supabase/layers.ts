import { supabase } from './client';

export type Layer = {
  id: string;
  frame_id: string;
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
