/**
 * Supabase Client Configuration
 *
 * This module initializes and exports the Supabase client instance.
 * The client is a singleton - we only create one instance for the entire app.
 *
 * ## What is Supabase?
 *
 * Supabase is a backend-as-a-service that provides:
 * - PostgreSQL database (for storing projects, frames, layers, etc.)
 * - Authentication (user accounts and login)
 * - Real-time subscriptions (for collaborative editing)
 * - Storage (for large files like exports)
 * - Edge Functions (serverless API endpoints)
 *
 * ## Security:
 *
 * The client uses two types of keys:
 * - **Anonymous Key**: Safe to expose in client code, has limited permissions
 * - **Service Role Key**: NEVER expose in client code, has full access
 *
 * Row Level Security (RLS) policies on the database ensure users can only
 * access their own data, even with the anonymous key.
 *
 * ## Configuration:
 *
 * The URL and key come from environment variables in the .env file:
 * - VITE_SUPABASE_URL=https://[project-id].supabase.co
 * - VITE_SUPABASE_ANON_KEY=eyJhbGc...
 *
 * @module lib/supabase/client
 */

import { createClient } from "@supabase/supabase-js"
import { supabaseConfig } from "../../config"

/**
 * Validate that required environment variables are present
 *
 * This check helps catch configuration errors early in development.
 * If these aren't set, database operations will fail mysteriously.
 */
const hasSupabaseConfig = Boolean(supabaseConfig.url && supabaseConfig.anonKey);

if (!hasSupabaseConfig) {
  console.error(
    "❌ Supabase configuration missing!\n" +
      "Make sure you have a .env file with:\n" +
      "  VITE_SUPABASE_URL=your-project-url\n" +
      "  VITE_SUPABASE_ANON_KEY=your-anon-key\n"
  )
}

/**
 * The Supabase client instance
 *
 * This is a singleton - we only create one instance and reuse it
 * throughout the application. Creating multiple instances is wasteful
 * and can cause connection issues.
 *
 * ## Usage:
 *
 * ```typescript
 * import { supabase } from "./lib/supabase/client"
 *
 * // Query data
 * const { data, error } = await supabase
 *   .from("projects")
 *   .select("*")
 *   .eq("user_id", userId)
 *
 * // Insert data
 * const { data, error } = await supabase
 *   .from("projects")
 *   .insert({ name: "My Project", user_id: userId })
 * ```
 *
 * ## Important Notes:
 *
 * 1. Always check for errors after database operations
 * 2. Use .maybeSingle() instead of .single() when you expect 0 or 1 results
 * 3. Row Level Security enforces access control - no need to filter by user_id manually
 */
const supabaseUrl = hasSupabaseConfig ? supabaseConfig.url : "https://placeholder.supabase.co";
const supabaseAnonKey = hasSupabaseConfig ? supabaseConfig.anonKey : "public-anon-key";

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Persist authentication state across page reloads
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
})

/**
 * Type-safe database schema
 *
 * This will be generated from the database schema once we create our tables.
 * For now, we'll define types manually in types.ts
 */
export type Database = {
  public: {
    Tables: {
      // Table types will be defined here once migrations are created
    }
  }
}
