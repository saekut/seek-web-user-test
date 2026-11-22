// ============================================================
//  ADMIN — login, user tests list, editor (with hotspot drawing),
//  and results dashboard.
// ============================================================
(function () {
  const $ = (id) => document.getElementById(id);
  const main = $("a-main");
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const slug = (s) => String(s || "").toLowerCase().normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/[\s_]+/g, "-").replace(/-+/g, "-").slice(0, 40) || "item";
  const fmtDate = (d) => d ? new Date(d).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "";
  const STATUS = { draft: "Draft", live: "Live", closed: "Closed" };
  const DEVICE_LABEL = { mobile: "Phone", desktop: "Computer" };

  let dirty = false;           // unsaved editor changes
  window.addEventListener("beforeunload", (e) => { if (dirty) { e.preventDefault(); e.returnValue = ""; } });

  // ---------------- toast ----------------
  let toastTimer;
  function toast(msg, bad) {
    const t = $("a-toast");
    t.textContent = msg;
    t.classList.toggle("bad", !!bad);
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (t.hidden = true), bad ? 6000 : 2600);
  }
  const errMsg = (e) => (e && (e.message || e.error_description)) || String(e);

  // two-click confirm for dangerous buttons
  function armed(btn, label, fn) {
    btn.addEventListener("click", async (e) => {
      e.preventDefault();
      if (btn.dataset.armed) { delete btn.dataset.armed; btn.textContent = btn.dataset.orig; await fn(); }
      else {
        btn.dataset.orig = btn.textContent; btn.dataset.armed = "1"; btn.textContent = label;
        setTimeout(() => { if (btn.dataset.armed) { delete btn.dataset.armed; btn.textContent = btn.dataset.orig; } }, 3500);
      }
    });
  }

  function testerLink(id, isDefault) {
    const base = location.href.split("#")[0].replace(/admin\.html.*$/, "");
    return base + (isDefault ? "" : "index.html?s=" + encodeURIComponent(id));
  }
  async function copy(text) {
    try { await navigator.clipboard.writeText(text); toast("Link copied"); }
    catch (e) { prompt("Copy this link:", text); }
  }
  function download(name, text, type) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type }));
    a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  // ---------------- auth ----------------
  function showOnly(id) {
    ["a-login", "a-newpass", "a-denied", "a-app"].forEach(x => ($(x).hidden = x !== id));
  }

  $("login-mark").innerHTML = icon("tap");
  $("brand-mark").innerHTML = icon("tap");
  $("denied-mark").innerHTML = icon("lock");

  async function boot() {
    if (window.DB_ERROR) { showOnly("a-login"); $("login-error").hidden = false; $("login-error").textContent = window.DB_ERROR; return; }
    $("demo-hint").hidden = DB.mode !== "local";
    $("mode-badge").hidden = DB.mode !== "local";
    if (location.hash.includes("type=recovery")) { showOnly("a-newpass"); return; }
    DB.onAuthChange((event) => { if (event === "PASSWORD_RECOVERY") showOnly("a-newpass"); });
    const user = await DB.getUser();
    if (!user) return showOnly("a-login");
    if (!(await DB.isAdmin())) return showOnly("a-denied");
    $("who").textContent = user.email || "";
    $("avatar").textContent = (user.email || "?").slice(0, 1);
    showOnly("a-app");
    route();
  }

  $("login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = e.target, err = $("login-error");
    err.hidden = true;
    const btn = f.querySelector("button"); btn.disabled = true; btn.textContent = "Signing in…";
    try {
      await DB.signIn(f.email.value.trim(), f.password.value);
      f.password.value = "";
      await boot();
    } catch (ex) {
      err.textContent = /invalid/i.test(errMsg(ex)) ? "Wrong email or password." : errMsg(ex);
      err.hidden = false;
    } finally { btn.disabled = false; btn.textContent = "Sign In"; }
  });
  $("forgot-link").addEventListener("click", async (e) => {
    e.preventDefault();
    const email = $("login-form").email.value.trim();
    const err = $("login-error");
    if (!email) { err.textContent = "Type your email above first, then click Forgot password."; err.hidden = false; return; }
    try { await DB.resetPassword(email); err.textContent = "If that email is an admin, a reset link is on its way."; }
    catch (ex) { err.textContent = errMsg(ex); }
    err.hidden = false;
  });
  $("newpass-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const msg = $("newpass-msg");
    try {
      await DB.updatePassword(e.target.password.value);
      history.replaceState(null, "", location.pathname + "#tests");
      toast("Password saved");
      await boot();
    } catch (ex) { msg.textContent = errMsg(ex); msg.hidden = false; }
  });
  async function logout() { if (dirty && !confirm("You have unsaved changes. Log out anyway?")) return; dirty = false; await DB.signOut(); location.hash = ""; showOnly("a-login"); }
  $("logout").addEventListener("click", logout);
  $("denied-logout").addEventListener("click", logout);

  // ---------------- routing ----------------
  let lastHash = location.hash;
  window.addEventListener("hashchange", () => {
    if (dirty && !confirm("You have unsaved changes. Leave without saving?")) {
      history.replaceState(null, "", lastHash || "#tests");
      return;
    }
    dirty = false;
    route();
  });
  function route() {
    if ($("a-app").hidden) return;
    lastHash = location.hash;
    const [view, id] = location.hash.replace(/^#/, "").split("/");
    window.scrollTo(0, 0);
    if (view === "edit" && id) return renderEditor(decodeURIComponent(id));
    if (view === "results" && id) return renderResults(decodeURIComponent(id));
    return renderList();
  }

  // ================================================================
  //  USER TESTS LIST
  // ================================================================
  async function renderList() {
    main.innerHTML = `<div class="r-head"><div><p class="eyebrow">Dashboard</p><h1>User tests</h1></div>
      <div class="r-actions"><button class="btn primary-solid" id="new-test">${icon("plus")} New Test</button></div></div>
      <div id="new-box" hidden></div>
      <div id="list"><div class="spinner"></div></div>`;
    $("new-test").addEventListener("click", () => openNewBox());

    let studies, counts;
    try { [studies, counts] = await Promise.all([DB.listStudies(), DB.sessionCounts()]); }
    catch (e) { $("list").innerHTML = `<p class="warn-text">Couldn't load: ${esc(errMsg(e))}</p>`; return; }
    window._studies = studies;

    if (!studies.length) {
      $("list").innerHTML = `<div class="panel empty-state"><div class="empty-icon">${icon("grid")}</div><h2>No user tests yet</h2><p class="muted">Click <b>New Test</b> to make your first one.</p></div>`;
      return;
    }
    $("list").innerHTML = `<div class="study-grid">${studies.map(s => {
      const c = counts[s.id] || { total: 0, completed: 0 };
      const nTasks = (s.config.tasks || []).length;
      const nScreens = Object.values(s.config.devices || {}).reduce((a, d) => a + (d.screens || []).length, 0);
      return `<article class="study-card" data-id="${esc(s.id)}">
        <div class="study-top">
          <span class="pill st-${s.status}">${STATUS[s.status]}</span>
          ${s.is_default ? `<span class="pill default" title="The plain site link opens this test">${icon("star")} Main link</span>` : ""}
        </div>
        <h3>${esc(s.title)}</h3>
        <p class="muted small">${nTasks} task${nTasks === 1 ? "" : "s"} · ${nScreens} screen${nScreens === 1 ? "" : "s"} · updated ${fmtDate(s.updated_at)}</p>
        <div class="study-stats"><div><b>${c.total}</b><span>testers</span></div><div><b>${c.completed}</b><span>finished</span></div></div>
        <div class="study-actions">
          <a class="btn primary-solid" href="#results/${encodeURIComponent(s.id)}">${icon("chart")} Results</a>
          <a class="btn" href="#edit/${encodeURIComponent(s.id)}">${icon("edit")} Edit</a>
          <button class="btn" data-act="copy">${icon("link")} Copy Link</button>
          <button class="btn icon-only" data-act="more" aria-haspopup="true" title="More">${icon("more")}</button>
        </div>
        <div class="more-menu" hidden>
          <label class="menu-row">Status
            <select data-act="status">${Object.entries(STATUS).map(([k, v]) => `<option value="${k}" ${k === s.status ? "selected" : ""}>${v}</option>`).join("")}</select>
          </label>
          ${s.is_default ? "" : `<button class="menu-btn" data-act="default">${icon("star")} Use as main link</button>`}
          <a class="menu-btn" href="${s.status === "live" ? testerLink(s.id, false) : testerLink(s.id, false) + "&preview=1"}" target="_blank" rel="noopener">${s.status === "live" ? icon("external") + " Open tester page" : icon("eye") + " Preview (not saved)"}</a>
          <button class="menu-btn" data-act="dup">${icon("duplicate")} Duplicate</button>
          <button class="menu-btn danger" data-act="delete">${icon("trash")} Delete test + results</button>
        </div>
      </article>`;
    }).join("")}</div>
    <p class="site-link">Only <b>Live</b> tests can be opened by testers. The test marked <b>Main link</b> opens from the plain site address: <a href="${testerLink("", true)}" target="_blank" rel="noopener">${esc(testerLink("", true))}</a></p>`;

    $("list").querySelectorAll(".study-card").forEach(card => {
      const s = studies.find(x => x.id === card.dataset.id);
      card.querySelector('[data-act="copy"]').addEventListener("click", () => {
        if (s.status !== "live") toast("Heads up: this test isn't Live yet, so testers can't open it.", true);
        copy(testerLink(s.id, s.is_default));
      });
      const menu = card.querySelector(".more-menu");
      card.querySelector('[data-act="more"]').addEventListener("click", () => {
        document.querySelectorAll(".more-menu").forEach(m => { if (m !== menu) m.hidden = true; });
        menu.hidden = !menu.hidden;
      });
      menu.querySelector('[data-act="status"]').addEventListener("change", async (e) => {
        try { await DB.saveStudy({ ...s, status: e.target.value }); toast(`"${s.title}" is now ${STATUS[e.target.value]}`); renderList(); }
        catch (ex) { toast(errMsg(ex), true); }
      });
      menu.querySelector('[data-act="default"]')?.addEventListener("click", async () => {
        try { await DB.setDefault(s.id); toast("Main link now opens this test"); renderList(); } catch (ex) { toast(errMsg(ex), true); }
      });
      menu.querySelector('[data-act="dup"]').addEventListener("click", () => createStudy(s.title + " (copy)", clone(s.config)));
      armed(menu.querySelector('[data-act="delete"]'), "Click again — deletes all its results", async () => {
        try { await DB.deleteStudy(s.id); toast("Deleted"); renderList(); } catch (ex) { toast(errMsg(ex), true); }
      });
    });
  }

  function openNewBox() {
    const box = $("new-box");
    const studies = window._studies || [];
    box.hidden = false;
    box.innerHTML = `<div class="panel">
      <h2>New user test</h2>
      <div class="row-2">
        <label class="field"><span>Name</span><input id="nt-title" placeholder="e.g. SEEk booking flow — round 2" /></label>
        <label class="field"><span>Start from</span><select id="nt-from">
          <option value="blank">Blank</option>
          <option value="demo">Demo (example SEEk wireframes)</option>
          ${studies.map(s => `<option value="copy:${esc(s.id)}">Copy of “${esc(s.title)}”</option>`).join("")}
        </select></label>
      </div>
      <div class="r-actions"><button class="btn primary-solid" id="nt-create">Create Test</button><button class="btn" id="nt-cancel">Cancel</button></div>
    </div>`;
    $("nt-title").focus();
    $("nt-cancel").onclick = () => (box.hidden = true);
    $("nt-create").onclick = () => {
      const title = $("nt-title").value.trim() || "Untitled user test";
      const from = $("nt-from").value;
      let config;
      if (from === "blank") config = blankConfig();
      else if (from === "demo") config = clone(window.DEMO_STUDY);
      else config = clone(studies.find(s => "copy:" + s.id === from).config);
      createStudy(title, config);
    };
  }

  function blankConfig() {
    return {
      title: "",
      intro: "Thanks for helping! You'll try a few short tasks on an early website design. There are no wrong answers — we're testing the design, not you.",
      fields: [
        { id: "name", label: "Your name", type: "text", required: true },
        { id: "age", label: "Age", type: "number", required: false },
      ],
      tasks: [],
      ratingQuestion: "How easy was this task?",
      devices: {
        mobile: { label: "Phone", start: "", screens: [] },
        desktop: { label: "Computer", start: "", screens: [] },
      },
    };
  }

  async function createStudy(title, config) {
    const existing = new Set((window._studies || []).map(s => s.id));
    let id = slug(title), n = 2;
    while (existing.has(id)) id = slug(title) + "-" + n++;
    config.title = title;
    try {
      await DB.saveStudy({ id, title, status: "draft", config });
      toast("Created as Draft");
      location.hash = "#edit/" + encodeURIComponent(id);
    } catch (e) { toast(errMsg(e), true); }
  }

  // ================================================================
  //  RESULTS
  // ================================================================
  async function renderResults(id) {
    main.innerHTML = `<div class="spinner"></div>`;
    let study, sessions;
    try { [study, sessions] = await Promise.all([DB.getStudy(id), DB.listSessions(id)]); }
    catch (e) { main.innerHTML = `<p class="warn-text">Couldn't load: ${esc(errMsg(e))}</p>`; return; }
    if (!study) { main.innerHTML = `<p class="empty">That test doesn't exist. <a href="#tests">Back to tests</a></p>`; return; }
    const cfg = { ...study.config, title: study.title };

    main.innerHTML = `<p class="crumb"><a href="#tests">${icon("back")} All Tests</a></p>
      <div class="r-head">
        <div><p class="eyebrow">Results · <span class="pill st-${study.status}">${STATUS[study.status]}</span></p><h1>${esc(study.title)}</h1></div>
        <div class="r-actions">
          <button class="btn" id="r-refresh">${icon("refresh")} Refresh</button>
          <button class="btn" id="r-csv">${icon("download")} CSV</button>
          <button class="btn" id="r-json">${icon("download")} JSON</button>
          <a class="btn" href="#edit/${encodeURIComponent(id)}">${icon("edit")} Edit</a>
          <button class="btn danger" id="r-clear">${icon("trash")} Delete All</button>
        </div>
      </div>
      <div id="r-body"></div>`;
    $("r-refresh").onclick = () => renderResults(id);
    $("r-csv").onclick = () => download(`${id}-results.csv`, Results.toCSV(), "text/csv");
    $("r-json").onclick = () => download(`${id}-results.json`, Results.toJSON(), "application/json");
    armed($("r-clear"), "Click again to delete ALL results", async () => {
      try { await DB.deleteSessionsForStudy(id); toast("All results deleted"); renderResults(id); } catch (e) { toast(errMsg(e), true); }
    });
    Results.render($("r-body"), cfg, sessions, {
      onDeleteSession: async (sid) => {
        try { await DB.deleteSession(sid); toast("Deleted"); renderResults(id); } catch (e) { toast(errMsg(e), true); }
      },
    });
    if (!sessions.length) {
      $("r-body").insertAdjacentHTML("afterbegin", `<div class="r-note">No testers yet. ${study.status === "live"
        ? `Share the link: <a href="${testerLink(id, study.is_default)}" target="_blank" rel="noopener">${esc(testerLink(id, study.is_default))}</a>`
        : `This test is <b>${STATUS[study.status]}</b> — set it to <b>Live</b> in Edit so testers can open it.`}</div>`);
    }
  }

  // ================================================================
  //  EDITOR
  // ================================================================
  let ed = null; // { row, cfg, tab, device, screenId, hotspotIdx, resultCount }

  async function renderEditor(id) {
    main.innerHTML = `<div class="spinner"></div>`;
    let row, sessions;
    try { [row, sessions] = await Promise.all([DB.getStudy(id), DB.listSessions(id)]); }
    catch (e) { main.innerHTML = `<p class="warn-text">Couldn't load: ${esc(errMsg(e))}</p>`; return; }
    if (!row) { main.innerHTML = `<p class="empty">That test doesn't exist. <a href="#tests">Back to tests</a></p>`; return; }
    const cfg = clone(row.config);
    cfg.fields ||= []; cfg.tasks ||= []; cfg.devices ||= {};
    ["mobile", "desktop"].forEach(k => { if (cfg.devices[k]) { cfg.devices[k].screens ||= []; cfg.devices[k].label ||= DEVICE_LABEL[k]; } });
    const firstDev = cfg.devices.mobile ? "mobile" : cfg.devices.desktop ? "desktop" : "mobile";
    ed = { row: { ...row }, cfg, tab: ed && ed.row.id === id ? ed.tab : "basics", device: firstDev, screenId: null, hotspotIdx: -1, resultCount: sessions.length };
    dirty = false;

    main.innerHTML = `<p class="crumb"><a href="#tests">${icon("back")} All Tests</a></p>
      <div class="r-head">
        <div><p class="eyebrow">Edit Test</p><h1 id="ed-title"></h1></div>
        <div class="r-actions">
          <a class="btn" id="ed-preview" target="_blank" rel="noopener">${icon("eye")} Preview</a>
          <a class="btn" href="#results/${encodeURIComponent(id)}">${icon("chart")} Results (${sessions.length})</a>
        </div>
      </div>
      ${sessions.length ? `<div class="r-note">This test already has <b>${sessions.length}</b> tester result${sessions.length === 1 ? "" : "s"}. Changing screens, hotspots or tasks can make older results harder to compare — for a big change, use <b>Duplicate</b> and start a new round instead.</div>` : ""}
      <nav class="ed-tabs" id="ed-tabs">
        <button data-tab="basics">Basics</button>
        <button data-tab="fields">Tester Details</button>
        <button data-tab="screens">Screens &amp; Hotspots</button>
        <button data-tab="tasks">Tasks</button>
        <button data-tab="json">Advanced</button>
      </nav>
      <div id="ed-body"></div>
      <div class="savebar" id="savebar">
        <span id="save-state" class="muted small">All changes saved</span>
        <span id="ed-problems" class="warn-text small"></span>
        <button class="btn primary-solid" id="ed-save">Save</button>
      </div>`;
    $("ed-preview").href = testerLink(id, false) + "&preview=1";
    $("ed-tabs").addEventListener("click", (e) => {
      const b = e.target.closest("button[data-tab]"); if (!b) return;
      ed.tab = b.dataset.tab; renderTab();
    });
    $("ed-save").addEventListener("click", saveEditor);
    renderTab();
  }
  function onSaveKey(e) {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s" && ed && document.getElementById("ed-save")) { e.preventDefault(); saveEditor(); }
  }

  function markDirty() {
    dirty = true;
    $("save-state").textContent = "Unsaved changes";
    $("save-state").classList.add("unsaved");
    validate();
  }
  function validate() {
    const probs = [];
    const devs = Object.keys(ed.cfg.devices).filter(k => (ed.cfg.devices[k].screens || []).length);
    if (!devs.length) probs.push("no screens yet");
    devs.forEach(k => {
      const d = ed.cfg.devices[k];
      if (!d.screens.some(s => s.id === d.start)) probs.push(`${DEVICE_LABEL[k]}: pick a start screen`);
      ed.cfg.tasks.forEach((t, i) => { if (!d.screens.some(s => s.id === t.goal)) probs.push(`${DEVICE_LABEL[k]}: task ${i + 1}'s goal screen is missing`); });
    });
    if (!ed.cfg.tasks.length) probs.push("no tasks yet");
    const el = $("ed-problems");
    if (el) el.textContent = probs.length ? "⚠ " + probs.slice(0, 2).join(" · ") + (probs.length > 2 ? ` (+${probs.length - 2} more)` : "") : "";
    return probs;
  }

  async function saveEditor() {
    const btn = $("ed-save");
    const probs = validate();
    if (ed.row.status === "live" && probs.length) {
      toast("Can't save a Live test with problems: " + probs[0] + ". Fix it, or set the status to Draft.", true);
      return;
    }
    btn.disabled = true; btn.textContent = "Saving…";
    try {
      ed.cfg.title = ed.row.title;
      await DB.saveStudy({ id: ed.row.id, title: ed.row.title, status: ed.row.status, config: ed.cfg });
      dirty = false;
      $("save-state").textContent = "All changes saved";
      $("save-state").classList.remove("unsaved");
      toast(ed.row.status === "live" ? "Saved — the live test is updated" : "Saved");
    } catch (e) { toast("Couldn't save: " + errMsg(e), true); }
    finally { btn.disabled = false; btn.textContent = "Save"; }
  }

  function renderTab() {
    $("ed-title").textContent = ed.row.title;
    $("ed-tabs").querySelectorAll("button").forEach(b => b.classList.toggle("on", b.dataset.tab === ed.tab));
    const body = $("ed-body");
    ({ basics: tabBasics, fields: tabFields, tasks: tabTasks, screens: tabScreens, json: tabJson })[ed.tab](body);
    validate();
  }

  // ---------- Basics ----------
  function tabBasics(body) {
    body.innerHTML = `<div class="panel">
      <label class="field"><span>Test name (testers see this)</span><input id="b-title" /></label>
      <label class="field"><span>Welcome message</span><textarea id="b-intro" rows="3"></textarea></label>
      <label class="field"><span>Rating question (asked after every task)</span><input id="b-rating" /></label>
      <label class="field"><span>Status</span>
        <select id="b-status">
          <option value="draft">Draft — only you can preview it</option>
          <option value="live">Live — testers can open the link</option>
          <option value="closed">Closed — link shows "not open"; results kept</option>
        </select>
      </label>
      <p class="muted small">Tester link: <a href="${testerLink(ed.row.id, false)}" target="_blank" rel="noopener">${esc(testerLink(ed.row.id, false))}</a></p>
    </div>`;
    const bind = (id, get, set) => { const el = $(id); el.value = get(); el.addEventListener("input", () => { set(el.value); markDirty(); }); };
    bind("b-title", () => ed.row.title, v => { ed.row.title = v; $("ed-title").textContent = v; });
    bind("b-intro", () => ed.cfg.intro || "", v => (ed.cfg.intro = v));
    bind("b-rating", () => ed.cfg.ratingQuestion || "", v => (ed.cfg.ratingQuestion = v));
    const st = $("b-status"); st.value = ed.row.status;
    st.addEventListener("change", () => { ed.row.status = st.value; markDirty(); });
  }

  // ---------- Tester details ----------
  function tabFields(body) {
    const f = ed.cfg.fields;
    body.innerHTML = `<div class="panel">
      <p class="muted small" style="margin-top:0">What testers fill in before starting. Keep one field with the ID <b>name</b> — it's used to label testers in results.</p>
      <div id="f-list" class="rows"></div>
      <button class="btn add-btn" id="f-add">${icon("plus")} Add Question</button>
    </div>`;
    const list = $("f-list");
    list.innerHTML = f.map((x, i) => `<div class="row-card" data-i="${i}">
      <div class="row-grid">
        <label class="field"><span>Question</span><input data-k="label" value="${esc(x.label)}" /></label>
        <label class="field"><span>Answer type</span><select data-k="type">
          ${["text", "number", "email", "select"].map(t => `<option value="${t}" ${x.type === t ? "selected" : ""}>${{ text: "Text", number: "Number", email: "Email", select: "Pick from list" }[t]}</option>`).join("")}
        </select></label>
        <label class="field opts" ${x.type === "select" ? "" : "hidden"}><span>Choices (comma separated)</span><input data-k="options" value="${esc((x.options || []).join(", "))}" /></label>
        <label class="field check"><input type="checkbox" data-k="required" ${x.required ? "checked" : ""} /> Required</label>
      </div>
      <div class="row-tools"><span class="muted small">ID: ${esc(x.id)}</span>${rowTools(i, f.length)}</div>
    </div>`).join("") || `<p class="muted">No questions — testers go straight to the tasks.</p>`;
    list.querySelectorAll(".row-card").forEach(card => {
      const i = +card.dataset.i, x = f[i];
      card.querySelectorAll("[data-k]").forEach(el => {
        el.addEventListener(el.type === "checkbox" || el.tagName === "SELECT" ? "change" : "input", () => {
          const k = el.dataset.k;
          if (k === "required") x.required = el.checked;
          else if (k === "options") x.options = el.value.split(",").map(s => s.trim()).filter(Boolean);
          else x[k] = el.value;
          if (k === "type") card.querySelector(".opts").hidden = el.value !== "select";
          markDirty();
        });
      });
      bindRowTools(card, f, i, () => tabFields(body));
    });
    $("f-add").onclick = () => {
      const ids = new Set(f.map(x => x.id));
      let id = "q" + (f.length + 1); while (ids.has(id)) id += "x";
      f.push({ id, label: "New question", type: "text", required: false });
      markDirty(); tabFields(body);
    };
  }

  function rowTools(i, n) {
    return `<span class="tools">
      <button class="icon-btn" data-move="-1" ${i === 0 ? "disabled" : ""} title="Move up">${icon("up")}</button>
      <button class="icon-btn" data-move="1" ${i === n - 1 ? "disabled" : ""} title="Move down">${icon("down")}</button>
      <button class="icon-btn danger" data-remove title="Remove">${icon("trash")}</button></span>`;
  }
  function bindRowTools(card, arr, i, rerender) {
    card.querySelectorAll("[data-move]").forEach(b => b.addEventListener("click", () => {
      const j = i + +b.dataset.move;
      [arr[i], arr[j]] = [arr[j], arr[i]];
      markDirty(); rerender();
    }));
    armed(card.querySelector("[data-remove]"), "Sure?", async () => { arr.splice(i, 1); markDirty(); rerender(); });
  }

  // ---------- Tasks ----------
  function allScreenIds() {
    const m = new Map();
    Object.entries(ed.cfg.devices).forEach(([k, d]) => (d.screens || []).forEach(s => {
      if (!m.has(s.id)) m.set(s.id, { name: s.name, devs: [] });
      m.get(s.id).devs.push(DEVICE_LABEL[k]);
    }));
    return m;
  }
  function tabTasks(body) {
    const t = ed.cfg.tasks;
    const screens = allScreenIds();
    const devCount = Object.values(ed.cfg.devices).filter(d => (d.screens || []).length).length;
    body.innerHTML = `<div class="panel">
      <p class="muted small" style="margin-top:0">Each task ends successfully when the tester reaches its <b>goal screen</b>. If you test both phone and computer, use the same screen ID in both so one goal works for both.</p>
      ${screens.size ? "" : `<p class="warn-text">Add screens first (Screens &amp; hotspots tab) so you can pick goal screens.</p>`}
      <div id="t-list" class="rows"></div>
      <button class="btn add-btn" id="t-add">${icon("plus")} Add Task</button>
    </div>`;
    const opts = (sel) => `<option value="">— pick goal screen —</option>` + [...screens.entries()].map(([id, v]) =>
      `<option value="${esc(id)}" ${id === sel ? "selected" : ""}>${esc(v.name)} (${esc(id)})${devCount > 1 && v.devs.length < devCount ? " — " + v.devs.join("/") + " only" : ""}</option>`).join("");
    $("t-list").innerHTML = t.map((x, i) => `<div class="row-card" data-i="${i}">
      <div class="row-num">Task ${i + 1}</div>
      <div class="row-grid">
        <label class="field"><span>Short title (shown to testers)</span><input data-k="title" value="${esc(x.title)}" /></label>
        <label class="field"><span>Goal screen</span><select data-k="goal">${opts(x.goal)}</select></label>
        <label class="field wide-col"><span>Task instructions</span><textarea data-k="prompt" rows="2">${esc(x.prompt)}</textarea></label>
      </div>
      <div class="row-tools"><span class="muted small">ID: ${esc(x.id)}</span>${rowTools(i, t.length)}</div>
    </div>`).join("") || `<p class="muted">No tasks yet.</p>`;
    $("t-list").querySelectorAll(".row-card").forEach(card => {
      const i = +card.dataset.i, x = t[i];
      card.querySelectorAll("[data-k]").forEach(el => el.addEventListener(el.tagName === "SELECT" ? "change" : "input", () => { x[el.dataset.k] = el.value; markDirty(); }));
      bindRowTools(card, t, i, () => tabTasks(body));
    });
    $("t-add").onclick = () => {
      const ids = new Set(t.map(x => x.id));
      let n = t.length + 1; while (ids.has("t" + n)) n++;
      t.push({ id: "t" + n, title: "New task", prompt: "Describe what the tester should do.", goal: "" });
      markDirty(); tabTasks(body);
    };
  }

  // ---------- Advanced JSON ----------
  function tabJson(body) {
    body.innerHTML = `<div class="panel">
      <p class="muted small" style="margin-top:0">The whole test setup as JSON. Only edit this if you know what you're changing.</p>
      <textarea id="j-text" class="code" rows="24" spellcheck="false"></textarea>
      <p class="warn-text" id="j-err" hidden></p>
      <div class="r-actions" style="margin-top:12px"><button class="btn primary-solid" id="j-apply">Apply JSON</button></div>
    </div>`;
    $("j-text").value = JSON.stringify(ed.cfg, null, 2);
    $("j-apply").onclick = () => {
      try {
        const v = JSON.parse($("j-text").value);
        if (!v || typeof v !== "object" || !Array.isArray(v.tasks) || !Array.isArray(v.fields) || typeof v.devices !== "object") throw new Error("Needs fields, tasks and devices");
        ed.cfg = v; markDirty(); toast("Applied — remember to Save"); $("j-err").hidden = true;
      } catch (e) { $("j-err").textContent = "Not valid: " + errMsg(e); $("j-err").hidden = false; }
    };
  }

  // ---------- Screens & hotspots ----------
  function tabScreens(body) {
    const devs = ed.cfg.devices;
    const dev = ed.device;
    const d = devs[dev];
    const screens = d ? d.screens : [];
    if (d && !screens.some(s => s.id === ed.screenId)) { ed.screenId = screens[0]?.id || null; ed.hotspotIdx = -1; }
    const sc = d && screens.find(s => s.id === ed.screenId);

    body.innerHTML = `<div class="panel">
      <div class="dev-tabs">
        ${["mobile", "desktop"].map(k => `<button data-dev="${k}" class="${k === dev ? "on" : ""}">${icon(k === "mobile" ? "phone" : "laptop")} ${DEVICE_LABEL[k]} <span class="muted">${devs[k] ? devs[k].screens.length : "off"}</span></button>`).join("")}
      </div>
      ${!d ? `<div class="empty-state"><div class="empty-icon">${icon(dev === "mobile" ? "phone" : "laptop")}</div><h2>${DEVICE_LABEL[dev]} version is off</h2><p class="muted">Testers won't be offered it.</p><button class="btn primary-solid" id="dev-on">Turn On ${DEVICE_LABEL[dev]} Version</button></div>` : `
      <div class="scr-layout">
        <aside class="scr-list">
          <div class="scr-list-head">
            <b>Screens</b>
            <label class="btn small-solid">${icon("upload")} Upload<input type="file" id="up" accept="image/*" multiple hidden /></label>
          </div>
          <p class="muted tiny">Export frames from Figma as PNG (1x or 2x) and upload them. The ★ screen is where every task starts.</p>
          <div id="scr-items">${screens.map(s => `
            <div class="scr-item ${s.id === ed.screenId ? "on" : ""}" data-id="${esc(s.id)}">
              <img src="${esc(s.image)}" alt="" loading="lazy" />
              <div><div class="scr-name">${d.start === s.id ? "★ " : ""}${esc(s.name)}</div><div class="muted tiny">${esc(s.id)} · ${s.hotspots.length} hotspot${s.hotspots.length === 1 ? "" : "s"}</div></div>
            </div>`).join("") || `<p class="muted small">No screens yet — upload some.</p>`}</div>
          <div class="dev-off">${Object.keys(devs).length > 1 ? `<button class="btn link-danger" id="dev-off">Turn off ${DEVICE_LABEL[dev]} version</button>` : ""}</div>
        </aside>
        <section class="scr-edit">${sc ? screenEditorHTML(sc, d) : `<div class="empty-state"><div class="empty-icon">${icon("upload")}</div><h2>No screens yet</h2><p class="muted">Upload your Figma frames to start drawing hotspots.</p></div>`}</section>
      </div>`}
    </div>`;

    body.querySelectorAll("[data-dev]").forEach(b => b.addEventListener("click", () => { ed.device = b.dataset.dev; ed.screenId = null; tabScreens(body); }));
    if (!d) {
      $("dev-on").onclick = () => { devs[dev] = { label: DEVICE_LABEL[dev], start: "", screens: [] }; markDirty(); tabScreens(body); };
      return;
    }
    $("dev-off")?.addEventListener("click", () => {
      if (screens.length && !confirm(`Turn off the ${DEVICE_LABEL[dev]} version? Its ${screens.length} screens and hotspots will be removed from this test.`)) return;
      delete devs[dev]; markDirty(); tabScreens(body);
    });
    body.querySelectorAll(".scr-item").forEach(el => el.addEventListener("click", () => { ed.screenId = el.dataset.id; ed.hotspotIdx = -1; tabScreens(body); }));
    $("up").addEventListener("change", (e) => uploadScreens([...e.target.files], d, body));
    if (sc) bindScreenEditor(sc, d, body);
  }

  async function uploadScreens(files, d, body) {
    if (!files.length) return;
    let done = 0;
    toast(`Uploading ${files.length} screen${files.length > 1 ? "s" : ""}…`);
    for (const file of files) {
      try {
        if (file.size > 8 * 1024 * 1024) throw new Error(`${file.name} is over 8 MB — export at 1x or as JPG`);
        const size = await imageSize(file);
        const url = await DB.uploadScreen(file, ed.row.id);
        const base = file.name.replace(/\.[^.]+$/, "");
        const ids = new Set(d.screens.map(s => s.id));
        let id = slug(base), n = 2; while (ids.has(id)) id = slug(base) + "-" + n++;
        d.screens.push({ id, name: base.replace(/[-_]+/g, " ").trim() || id, image: url, width: size.w, height: size.h, hotspots: [] });
        if (!d.start) d.start = id;
        ed.screenId = ed.screenId || id;
        done++;
      } catch (e) { toast(errMsg(e), true); }
    }
    if (done) { markDirty(); toast(`${done} uploaded — remember to Save`); }
    tabScreens(body);
  }
  function imageSize(file) {
    return new Promise((res, rej) => {
      const u = URL.createObjectURL(file), im = new Image();
      im.onload = () => { res({ w: im.naturalWidth, h: im.naturalHeight }); URL.revokeObjectURL(u); };
      im.onerror = () => rej(new Error(file.name + " isn't an image"));
      im.src = u;
    });
  }

  function screenEditorHTML(sc, d) {
    const others = d.screens;
    const h = sc.hotspots[ed.hotspotIdx];
    return `
      <div class="scr-props">
        <label class="field"><span>Screen name</span><input id="s-name" value="${esc(sc.name)}" /></label>
        <label class="field"><span>Screen ID</span><input id="s-id" value="${esc(sc.id)}" /></label>
        <div class="scr-btns">
          <button class="btn" id="s-start" ${d.start === sc.id ? "disabled" : ""}>${icon("star")} ${d.start === sc.id ? "Start Screen" : "Make Start Screen"}</button>
          <label class="btn">${icon("upload")} Replace Image<input type="file" id="s-replace" accept="image/*" hidden /></label>
          <button class="btn link-danger" id="s-del">Delete screen</button>
        </div>
      </div>
      <div class="hs-help muted small"><b>Draw a hotspot:</b> drag on the image over a button. Click a hotspot to select it, drag to move, use the corner to resize.</div>
      <div class="hs-layout">
        <div class="hs-canvas-wrap ${ed.device}">
          <div class="hs-canvas" id="hs-canvas">
            <img src="${esc(sc.image)}" alt="" draggable="false" />
            ${sc.hotspots.map((x, i) => `<div class="hs ${i === ed.hotspotIdx ? "sel" : ""} ${x.to && others.some(o => o.id === x.to) ? "" : "broken"}" data-i="${i}"
                style="left:${x.x / sc.width * 100}%;top:${x.y / sc.height * 100}%;width:${x.w / sc.width * 100}%;height:${x.h / sc.height * 100}%">
                <span>${i + 1}</span>${i === ed.hotspotIdx ? '<i class="hs-handle"></i>' : ""}</div>`).join("")}
          </div>
        </div>
        <aside class="hs-side">
          <b>Hotspots on this screen</b>
          <div class="hs-items">${sc.hotspots.map((x, i) => `<div class="hs-item ${i === ed.hotspotIdx ? "on" : ""}" data-i="${i}">
              <span class="hs-num">${i + 1}</span>
              <span>→ ${x.to ? esc((others.find(o => o.id === x.to) || { name: "missing: " + x.to }).name) : "<i>pick a screen</i>"}</span></div>`).join("") || `<p class="muted small">None yet.</p>`}</div>
          ${h ? `<div class="hs-sel">
            <label class="field"><span>Hotspot ${ed.hotspotIdx + 1} goes to</span>
              <select id="hs-to"><option value="">— pick screen —</option>${others.map(o => `<option value="${esc(o.id)}" ${o.id === h.to ? "selected" : ""}>${esc(o.name)}</option>`).join("")}</select></label>
            <button class="btn link-danger" id="hs-del">Delete hotspot</button>
          </div>` : ""}
        </aside>
      </div>`;
  }

  function bindScreenEditor(sc, d, body) {
    const rerender = () => tabScreens(body);
    $("s-name").addEventListener("input", (e) => { sc.name = e.target.value; markDirty(); });
    $("s-name").addEventListener("change", rerender);
    $("s-id").addEventListener("change", (e) => {
      const nid = slug(e.target.value);
      if (!nid || nid === sc.id) { e.target.value = sc.id; return; }
      if (d.screens.some(s => s.id === nid)) { toast("Another screen already uses that ID", true); e.target.value = sc.id; return; }
      const old = sc.id;
      // Rename everywhere in this device + task goals
      d.screens.forEach(s => s.hotspots.forEach(h => { if (h.to === old) h.to = nid; }));
      if (d.start === old) d.start = nid;
      const usedElsewhere = Object.values(ed.cfg.devices).some(o => o !== d && o.screens.some(s => s.id === old));
      if (!usedElsewhere) ed.cfg.tasks.forEach(t => { if (t.goal === old) t.goal = nid; });
      sc.id = nid; ed.screenId = nid; markDirty(); rerender();
    });
    $("s-start").addEventListener("click", () => { d.start = sc.id; markDirty(); rerender(); });
    $("s-replace").addEventListener("change", async (e) => {
      const file = e.target.files[0]; if (!file) return;
      try {
        const size = await imageSize(file);
        const url = await DB.uploadScreen(file, ed.row.id);
        // keep hotspots in the same relative place if the size changed
        const fx = size.w / sc.width, fy = size.h / sc.height;
        sc.hotspots.forEach(h => { h.x = Math.round(h.x * fx); h.y = Math.round(h.y * fy); h.w = Math.round(h.w * fx); h.h = Math.round(h.h * fy); });
        Object.assign(sc, { image: url, width: size.w, height: size.h });
        markDirty(); toast("Image replaced — remember to Save"); rerender();
      } catch (ex) { toast(errMsg(ex), true); }
    });
    armed($("s-del"), "Click again to delete", async () => {
      d.screens.splice(d.screens.indexOf(sc), 1);
      if (d.start === sc.id) d.start = d.screens[0]?.id || "";
      ed.screenId = null; markDirty(); rerender();
    });
    body.querySelectorAll(".hs-item").forEach(el => el.addEventListener("click", () => { ed.hotspotIdx = +el.dataset.i; rerender(); }));
    $("hs-to")?.addEventListener("change", (e) => { sc.hotspots[ed.hotspotIdx].to = e.target.value; markDirty(); rerender(); });
    $("hs-del")?.addEventListener("click", () => { sc.hotspots.splice(ed.hotspotIdx, 1); ed.hotspotIdx = -1; markDirty(); rerender(); });

    // ---- drawing / moving / resizing ----
    const canvas = $("hs-canvas");
    const toPx = (e) => {
      const r = canvas.getBoundingClientRect();
      return {
        x: Math.max(0, Math.min(sc.width, (e.clientX - r.left) / r.width * sc.width)),
        y: Math.max(0, Math.min(sc.height, (e.clientY - r.top) / r.height * sc.height)),
      };
    };
    let drag = null;
    canvas.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      const p = toPx(e);
      const hsEl = e.target.closest(".hs");
      if (e.target.classList.contains("hs-handle")) {
        drag = { mode: "resize", i: ed.hotspotIdx, start: p, orig: { ...sc.hotspots[ed.hotspotIdx] } };
      } else if (hsEl) {
        const i = +hsEl.dataset.i;
        if (i !== ed.hotspotIdx) { ed.hotspotIdx = i; rerender(); return; }
        drag = { mode: "move", i, start: p, orig: { ...sc.hotspots[i] } };
      } else {
        const ghost = document.createElement("div");
        ghost.className = "hs sel drawing";
        canvas.appendChild(ghost);
        drag = { mode: "draw", start: p, ghost };
      }
      canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener("pointermove", (e) => {
      if (!drag) return;
      const p = toPx(e);
      if (drag.mode === "draw") {
        const r = rectFrom(drag.start, p);
        Object.assign(drag.ghost.style, { left: r.x / sc.width * 100 + "%", top: r.y / sc.height * 100 + "%", width: r.w / sc.width * 100 + "%", height: r.h / sc.height * 100 + "%" });
        drag.rect = r;
      } else {
        const h = sc.hotspots[drag.i], o = drag.orig;
        const dx = p.x - drag.start.x, dy = p.y - drag.start.y;
        if (drag.mode === "move") {
          h.x = Math.round(Math.max(0, Math.min(sc.width - o.w, o.x + dx)));
          h.y = Math.round(Math.max(0, Math.min(sc.height - o.h, o.y + dy)));
        } else {
          h.w = Math.round(Math.max(8, Math.min(sc.width - o.x, o.w + dx)));
          h.h = Math.round(Math.max(8, Math.min(sc.height - o.y, o.h + dy)));
        }
        const el = canvas.querySelector(`.hs[data-i="${drag.i}"]`);
        Object.assign(el.style, { left: h.x / sc.width * 100 + "%", top: h.y / sc.height * 100 + "%", width: h.w / sc.width * 100 + "%", height: h.h / sc.height * 100 + "%" });
        drag.moved = true;
      }
    });
    const end = () => {
      if (!drag) return;
      const dd = drag; drag = null;
      if (dd.mode === "draw") {
        dd.ghost.remove();
        const minSize = sc.width * 0.015;
        if (dd.rect && dd.rect.w >= minSize && dd.rect.h >= minSize) {
          sc.hotspots.push({ ...dd.rect, to: "" });
          ed.hotspotIdx = sc.hotspots.length - 1;
          markDirty(); rerender();
          setTimeout(() => $("hs-to")?.focus(), 0);
        }
      } else if (dd.moved) { markDirty(); rerender(); }
    };
    canvas.addEventListener("pointerup", end);
    canvas.addEventListener("pointercancel", end);
  }
  function rectFrom(a, b) {
    const x = Math.round(Math.min(a.x, b.x)), y = Math.round(Math.min(a.y, b.y));
    return { x, y, w: Math.round(Math.abs(a.x - b.x)), h: Math.round(Math.abs(a.y - b.y)) };
  }

  document.addEventListener("keydown", onSaveKey);

  // close "More" menus when clicking elsewhere
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".study-card")) document.querySelectorAll(".more-menu").forEach(m => (m.hidden = true));
  });

  boot();
})();
