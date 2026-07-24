// ============================================================
// CẤU HÌNH SUPABASE
// Vào Supabase Dashboard > Project Settings > API để lấy 2 giá trị bên dưới
// ============================================================
const SUPABASE_URL = "https://lzgeocvfzmjheywonenf.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_GYTVNGz5s917E8l245RSWQ_iTCFF6et";

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
