(() => {
  const config = window.scProductSupabaseConfig || {};
  const url = String(config.url || "").trim();
  const anonKey = String(config.anonKey || "").trim();

  if (!window.supabase || !url || !anonKey) return;
  window.supabaseClient = window.supabase.createClient(url, anonKey);
})();
