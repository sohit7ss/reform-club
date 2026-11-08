import { createClient } from '@supabase/supabase-js'
const url=import.meta.env.VITE_SUPABASE_URL, key=import.meta.env.VITE_SUPABASE_ANON_KEY
export const isSupabaseConfigured=Boolean(url && key)
export const supabaseUrl=url||''
export const supabaseAnonKey=key||''
export const bucket=import.meta.env.VITE_SUPABASE_BUCKET || 'reform-media'
export const submissionsBucket=import.meta.env.VITE_SUPABASE_SUBMISSIONS_BUCKET || 'reform-submissions'
export const supabase=isSupabaseConfigured ? createClient(url,key) : null
export function supabaseWithToken(token){ if(!isSupabaseConfigured) return null; return createClient(url,key,{global:{headers:{Authorization:`Bearer ${token}`}},auth:{persistSession:false}}) }
