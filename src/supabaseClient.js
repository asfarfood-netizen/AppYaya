import { createClient } from '@supabase/supabase-js'

export const SUPABASE_URL = 'https://urubesjnzvhubwcvmwhw.supabase.co'
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVydWJlc2puenZodWJ3Y3Ztd2h3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI0ODYzNzIsImV4cCI6MjA5ODA2MjM3Mn0.zHG3zHe5GGWQ9-T2eF1yiTNaQUaqDXYc7PNPIkp9vvo'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  realtime: {
    params: { eventsPerSecond: 10 }
  }
})

export default supabase
