// ============================================================
//  DB — one small API used by the tester page and the admin site.
//  Uses Supabase when js/config.js has keys, otherwise a local
//  demo mode that keeps everything in this browser.
// ============================================================
(function () {
  const C = window.SITE_CONFIG || {};
  const useSupabase = !!(C.SUPABASE_URL && C.SUPABASE_ANON_KEY && window.supabase);

  // ---------------- Supabase ----------------
  function supabaseBackend() {
    const sb = window.supabase.createClient(C.SUPABASE_URL, C.SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true },
    });
    const must = ({ data, error }) => { if (error) throw error; return data; };

    return {
      mode: "supabase",
      // ---- public ----
      async getPublicStudy(id) {
        let q = sb.from("studies").select("id,title,status,is_default,config").eq("status", "live");
        if (id) q = q.eq("id", id);
        const rows = must(await q.order("is_default", { ascending: false }).order("updated_at", { ascending: false }).limit(1));
        return rows[0] || null;
      },
      async saveSession(session) {
        const { secret, ...data } = session;
        must(await sb.rpc("save_session", {
          p_id: session.id, p_secret: secret, p_study: session.studyId, p_data: data, p_completed: !!session.completed,
        }));
      },
      // ---- auth ----
      async signIn(email, password) {
        must(await sb.auth.signInWithPassword({ email, password }));
      },
      async signOut() { await sb.auth.signOut(); },
      async getUser() { const { data } = await sb.auth.getUser(); return data.user || null; },
      async isAdmin() { return !!must(await sb.rpc("is_admin")); },
      async resetPassword(email) {
        must(await sb.auth.resetPasswordForEmail(email, { redirectTo: location.href.split("#")[0] }));
      },
      async updatePassword(password) { must(await sb.auth.updateUser({ password })); },
      onAuthChange(fn) { sb.auth.onAuthStateChange((event) => fn(event)); },
      // ---- admin ----
      async listStudies() {
        return must(await sb.from("studies").select("id,title,status,is_default,config,created_at,updated_at").order("created_at", { ascending: false }));
      },
      async sessionCounts() {
        const rows = must(await sb.from("sessions").select("study_id,completed"));
        const out = {};
        rows.forEach(r => { const o = (out[r.study_id] ||= { total: 0, completed: 0 }); o.total++; if (r.completed) o.completed++; });
        return out;
      },
      async getStudy(id) {
        const rows = must(await sb.from("studies").select("*").eq("id", id).limit(1));
        return rows[0] || null;
      },
      async saveStudy(row) {
        const payload = { id: row.id, title: row.title, status: row.status, config: row.config, updated_at: new Date().toISOString() };
        must(await sb.from("studies").upsert(payload));
      },
      async deleteStudy(id) { must(await sb.from("studies").delete().eq("id", id)); },
      async setDefault(id) { must(await sb.rpc("set_default_study", { p_id: id })); },
      async listSessions(studyId) {
        const rows = must(await sb.from("sessions").select("id,data,completed,created_at").eq("study_id", studyId).order("created_at", { ascending: false }).limit(5000));
        return rows.map(r => ({ ...r.data, id: r.id }));
      },
      async deleteSession(id) { must(await sb.from("sessions").delete().eq("id", id)); },
      async deleteSessionsForStudy(studyId) { must(await sb.from("sessions").delete().eq("study_id", studyId)); },
      async uploadScreen(file, studyId) {
        const ext = (file.name.split(".").pop() || "png").toLowerCase().replace(/[^a-z0-9]/g, "");
        const path = `${studyId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        must(await sb.storage.from("screens").upload(path, file, { cacheControl: "31536000", upsert: false, contentType: file.type || undefined }));
        return sb.storage.from("screens").getPublicUrl(path).data.publicUrl;
      },
    };
  }

  // ---------------- Local demo mode ----------------
  function localBackend() {
    const K_STUDIES = "seek_ut_local_studies", K_SESS = "seek_ut_local_sessions", K_AUTH = "seek_ut_local_admin";
    const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch (e) { return d; } };
    const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { console.warn(e); } };
    const nowIso = () => new Date().toISOString();

    function studies() {
      let s = read(K_STUDIES, null);
      if (!s) {
        s = [{ id: "seek-demo", title: window.DEMO_STUDY.title, status: "live", is_default: true, config: window.DEMO_STUDY, created_at: nowIso(), updated_at: nowIso() }];
        write(K_STUDIES, s);
      }
      return s;
    }
    const sessions = () => read(K_SESS, []);

    return {
      mode: "local",
      async getPublicStudy(id) {
        const live = studies().filter(s => s.status === "live" && (!id || s.id === id));
        live.sort((a, b) => (b.is_default - a.is_default) || (b.updated_at > a.updated_at ? 1 : -1));
        return live[0] || null;
      },
      async saveSession(session) {
        const st = studies().find(s => s.id === session.studyId);
        if (!st || st.status !== "live") throw new Error("This test is not open");
        const all = sessions();
        const i = all.findIndex(s => s.id === session.id);
        if (i >= 0 && all[i].secret !== session.secret) throw new Error("Bad secret");
        if (i >= 0) all[i] = session; else all.push(session);
        write(K_SESS, all);
      },
      async signIn(email, password) {
        if (password !== "admin") throw new Error("Demo mode: the password is \"admin\"");
        write(K_AUTH, { email });
      },
      async signOut() { localStorage.removeItem(K_AUTH); },
      async getUser() { return read(K_AUTH, null); },
      async isAdmin() { return !!read(K_AUTH, null); },
      async resetPassword() { throw new Error("Not available in demo mode"); },
      async updatePassword() { throw new Error("Not available in demo mode"); },
      onAuthChange() {},
      async listStudies() { return studies().slice().sort((a, b) => (b.created_at > a.created_at ? 1 : -1)); },
      async sessionCounts() {
        const out = {};
        sessions().forEach(r => { const o = (out[r.studyId] ||= { total: 0, completed: 0 }); o.total++; if (r.completed) o.completed++; });
        return out;
      },
      async getStudy(id) { return studies().find(s => s.id === id) || null; },
      async saveStudy(row) {
        const all = studies();
        const i = all.findIndex(s => s.id === row.id);
        const merged = { ...(all[i] || { created_at: nowIso(), is_default: false }), ...row, updated_at: nowIso() };
        if (i >= 0) all[i] = merged; else all.push(merged);
        write(K_STUDIES, all);
      },
      async deleteStudy(id) {
        write(K_STUDIES, studies().filter(s => s.id !== id));
        write(K_SESS, sessions().filter(s => s.studyId !== id));
      },
      async setDefault(id) { write(K_STUDIES, studies().map(s => ({ ...s, is_default: s.id === id }))); },
      async listSessions(studyId) {
        return sessions().filter(s => s.studyId === studyId).map(({ secret, ...s }) => s).sort((a, b) => b.startedAt - a.startedAt);
      },
      async deleteSession(id) { write(K_SESS, sessions().filter(s => s.id !== id)); },
      async deleteSessionsForStudy(studyId) { write(K_SESS, sessions().filter(s => s.studyId !== studyId)); },
      async uploadScreen(file) {
        return await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); });
      },
    };
  }

  const keysSet = !!(C.SUPABASE_URL && C.SUPABASE_ANON_KEY);
  if (keysSet && !window.supabase) {
    window.DB_ERROR = "Couldn't connect to the database. Check your internet connection and reload.";
  }
  window.DB = useSupabase ? supabaseBackend() : localBackend();
  window.esc = (s) => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
})();
