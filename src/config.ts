/**
 * Application Configuration
 *
 * This file contains runtime configuration that may change based on
 * environment or user settings.
 */

export const supabaseConfig = {
  url: import.meta.env.VITE_SUPABASE_URL || "",
  anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY || ""
}

export const devConfig = {
  isDevelopment: import.meta.env.DEV,
  isProduction: import.meta.env.PROD
}
