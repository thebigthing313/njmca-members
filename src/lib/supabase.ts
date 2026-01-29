import { createClient } from '@supabase/supabase-js'
import { Database } from './database.types'
import { QueryClient } from '@tanstack/react-query'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

export const supabase = createClient<Database>(supabaseUrl, supabasePublishableKey)
export const queryClient = new QueryClient()