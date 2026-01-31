/**
 * src/lib/ai/prompts.ts
 * -----------------------------------------------------------------------------
 * ## AI PROMPT TEMPLATES (Noob Guide)
 * 
 * Think of this as the "AI's Cookbook". 
 * 
 * 1. TEMPLATES: Instead of typing long instructions every time, users 
 *    can pick a "Recipe" (template) like "Idle Hero".
 * 2. PROMPT: This is the actual text sent to the AI. We include 
 *    details like "32x32" and "vibrant palette" to make sure the 
 *    AI gives us a pixel-style result.
 * 
 * ## VAR TRACE
 * - `PIXEL_ART_PROMPTS`: (Origin: Constant) The master list of all templates.
 * - `label`: (Origin: UI display) The name shown in the dropdown menu.
 */
export type PromptTemplate = {
  label: string;
  prompt: string;
};

export const PIXEL_ART_PROMPTS: PromptTemplate[] = [
  { label: "Idle Hero", prompt: "Pixel art hero idle pose, 32x32, vibrant palette, crisp outline." },
  { label: "Walk Cycle", prompt: "Pixel art walk cycle for a traveler, 48x48, side view, 6 frames." },
  { label: "Jump Pose", prompt: "Pixel art jump pose with motion blur hints, 32x32, dynamic silhouette." },
  { label: "Forest Slime", prompt: "Pixel art forest slime creature, glossy highlights, 32x32." },
  { label: "Cyber Ninja", prompt: "Pixel art cyber ninja, neon accents, 64x64, dramatic lighting." },
  { label: "Village House", prompt: "Pixel art village house, warm lights, 64x64, cozy mood." },
  { label: "Potion Bottle", prompt: "Pixel art potion bottle with cork, 24x24, clear glass, simple shading." },
  { label: "Space Ship", prompt: "Pixel art small spaceship, 48x48, top-down, metallic tones." },
  { label: "Dungeon Tile", prompt: "Pixel art dungeon floor tile, seamless, 16x16, stone texture." },
  { label: "Desert Cactus", prompt: "Pixel art cactus, 32x32, bright desert palette." },
  { label: "Snowy Tree", prompt: "Pixel art snowy pine tree, 48x48, winter palette." },
  { label: "Boss Monster", prompt: "Pixel art boss monster, 96x96, chunky silhouette, menacing." },
  { label: "Treasure Chest", prompt: "Pixel art treasure chest, 32x32, metallic highlights, open lid." },
  { label: "Spell Effect", prompt: "Pixel art magic spell swirl, 32x32, blue glow, transparent background." },
  { label: "Castle Gate", prompt: "Pixel art castle gate, 64x64, stone blocks, iron bars." },
  { label: "Robot Drone", prompt: "Pixel art robot drone, 40x40, floating, sci-fi palette." },
  { label: "Ocean Wave", prompt: "Pixel art ocean wave tile, 32x32, animated look." },
  { label: "Volcano Tile", prompt: "Pixel art lava tile, 16x16, glowing cracks." },
  { label: "Marketplace NPC", prompt: "Pixel art NPC merchant, 48x48, friendly pose." },
  { label: "Stealth Cloak", prompt: "Pixel art stealth cloak icon, 24x24, moody shading." },
  { label: "Sci-Fi Door", prompt: "Pixel art sci-fi door, 48x48, glowing panel." },
  { label: "Battle UI Icon", prompt: "Pixel art UI icon for attack, 16x16, bold colors." },
];
