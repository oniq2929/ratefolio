import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Supabaseの接続情報が設定されていません。.env.example を参考に .env を作成し、' +
      'VITE_SUPABASE_URL と VITE_SUPABASE_ANON_KEY を設定してください。',
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
