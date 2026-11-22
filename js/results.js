// ============================================================
//  RESULTS PAGE — summary, task stats, heatmaps, tester details
// ============================================================
window.Results = (function () {
  let S = null;
  let root = null;
  let opts = {};
  const $ = (id) => root.querySelector("#" + id);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
  const pct = (x) => (x == null ? "–" : Math.round(x * 100) + "%");
  const fmtTime = (ms) => {
    if (ms == null) return "–";
    const s = Math.round(ms / 1000);
    return s < 60 ? s + "s" : Math.floor(s / 60) + "m " + String(s % 60).padStart(2, "0") + "s";
  };
  const stars = (n) => (n ? "★".repeat(n) + "☆".repeat(5 - n) : "–");
  const taskName = (id) => (S.tasks.find(t => t.id === id) || { title: id }).title;
  const screenName = (dev, id) => ((S.devices[dev]?.screens || []).find(s => s.id === id) || { name: id }).name;

  let sessions = [];

  const TEMPLATE = `
    <div class="tiles" id="tiles"></div>
    <section class="panel">
      <h2>Tasks</h2>
      <div class="table-scroll"><table id="task-table"></table></div>
    </section>
    <section class="panel">
      <h2>Heatmap &amp; scroll</h2>
      <div class="heat-controls">
        <select id="h-device"></select>
        <select id="h-screen"></select>
        <select id="h-task"></select>
        <select id="h-mode"><option value="heat">Heatmap</option><option value="dots">Click dots</option></select>
        <label><input type="checkbox" id="h-scroll" checked /> Show average scroll</label>
      </div>
      <div class="heat-layout">
        <div class="heat-box"><div class="heat-inner" id="h-inner"><img id="h-img" alt="" /><canvas id="h-canvas"></canvas></div></div>
        <div class="heat-stats" id="h-stats"></div>
      </div>
    </section>
    <section class="panel">
      <h2>Testers</h2>
      <p class="muted small" style="margin-top:-6px">Click a row to see their path, ratings and comments.</p>
      <div class="table-scroll"><table id="tester-table"></table></div>
    </section>`;

  function render(rootEl, study, list, options) {
    root = rootEl; S = study; opts = options || {};
    sessions = list.slice().sort((a, b) => b.startedAt - a.startedAt);
    if (!S.devices || !Object.keys(S.devices).some(k => (S.devices[k].screens || []).length)) {
      root.innerHTML = `<p class="empty">This test has no screens yet.</p>`; return;
    }
    root.innerHTML = TEMPLATE;
    bindHeat();
    renderTiles();
    renderTasks();
    renderHeatControls();
    renderHeat();
    renderTesters();
  }

  // ---------- tiles ----------
  function renderTiles() {
    const all = sessions.flatMap(s => s.tasks.filter(t => t.status !== "in_progress"));
    const succ = all.filter(t => t.status === "success").length;
    const ratings = all.map(t => t.rating).filter(Boolean);
    const devices = sessions.reduce((m, s) => ((m[s.device] = (m[s.device] || 0) + 1), m), {});
    const tiles = [
      ["Testers", sessions.length],
      ["Finished all tasks", sessions.filter(s => s.completed).length],
      ["Task success rate", all.length ? pct(succ / all.length) : "–"],
      ["Average rating", ratings.length ? avg(ratings).toFixed(1) + " / 5" : "–"],
      ["Phone / Computer", `${devices.mobile || 0} / ${devices.desktop || 0}`],
    ];
    $("tiles").innerHTML = tiles.map(([k, v]) => `<div class="tile"><div class="k">${k}</div><div class="v">${v}</div></div>`).join("");
  }

  // ---------- task table ----------
  function renderTasks() {
    const rows = S.tasks.map(t => {
      const res = sessions.flatMap(s => s.tasks.filter(x => x.taskId === t.id && x.status !== "in_progress"));
      const ok = res.filter(r => r.status === "success");
      const rate = res.length ? ok.length / res.length : null;
      const time = avg(ok.map(r => r.durationMs));
      const rating = avg(res.map(r => r.rating).filter(Boolean));
      const clicks = res.map(r => r.clicks.length);
      const miss = res.map(r => r.clicks.filter(c => !c.hit).length);
      const totalClicks = clicks.reduce((a, b) => a + b, 0);
      const missRate = totalClicks ? miss.reduce((a, b) => a + b, 0) / totalClicks : null;
      return `<tr>
        <td><b>${esc(t.title)}</b><div class="path">${esc(t.prompt)}</div></td>
        <td class="num">${res.length}</td>
        <td><div style="display:flex;align-items:center;gap:8px"><div class="bar" style="flex:1"><i style="width:${(rate || 0) * 100}%"></i></div><span>${pct(rate)}</span></div></td>
        <td class="num">${res.length - ok.length}</td>
        <td class="num">${fmtTime(time)}</td>
        <td class="num">${rating ? rating.toFixed(1) : "–"}</td>
        <td class="num">${pct(missRate)}</td>
      </tr>`;
    });
    $("task-table").innerHTML = `<thead><tr>
        <th>Task</th><th class="num">Attempts</th><th>Success</th><th class="num">Gave up</th>
        <th class="num">Avg time (success)</th><th class="num">Avg rating</th><th class="num">Misclicks</th>
      </tr></thead><tbody>${rows.join("")}</tbody>`;
  }

  // ---------- heatmap ----------
  let hDevice, hScreen, hTask, hMode, hScroll;
  function bindHeat() {
    hDevice = $("h-device"); hScreen = $("h-screen"); hTask = $("h-task"); hMode = $("h-mode"); hScroll = $("h-scroll");
    hDevice.addEventListener("change", () => { fillScreens(); renderHeat(); });
    [hScreen, hTask, hMode, hScroll].forEach(el => el.addEventListener("change", renderHeat));
  }

  function renderHeatControls() {
    const keepDev = hDevice.value, keepScreen = hScreen.value, keepTask = hTask.value;
    hDevice.innerHTML = Object.keys(S.devices).filter(k => (S.devices[k].screens || []).length).map(k => `<option value="${k}">${esc(S.devices[k].label)}</option>`).join("");
    if (keepDev && S.devices[keepDev]) hDevice.value = keepDev;
    fillScreens(keepScreen);
    hTask.innerHTML = `<option value="">All tasks</option>` + S.tasks.map(t => `<option value="${t.id}">${esc(t.title)}</option>`).join("");
    if (keepTask) hTask.value = keepTask;
  }
  function fillScreens(keep) {
    const list = S.devices[hDevice.value]?.screens || [];
    hScreen.innerHTML = list.map(s => `<option value="${s.id}">${esc(s.name)}</option>`).join("");
    if (keep && list.some(s => s.id === keep)) hScreen.value = keep;
  }

  function renderHeat() {
    const dev = hDevice.value;
    const sc = (S.devices[dev]?.screens || []).find(s => s.id === hScreen.value);
    if (!sc) return;
    const tasks = sessions.filter(s => s.device === dev)
      .flatMap(s => s.tasks)
      .filter(t => !hTask.value || t.taskId === hTask.value);
    const clicks = tasks.flatMap(t => t.clicks.filter(c => c.screen === sc.id));
    const visits = tasks.flatMap(t => t.path.filter(p => p.screen === sc.id));
    const scrollAvg = avg(visits.map(v => v.scrollMax).filter(v => v > 0));

    const inner = $("h-inner");
    const img = $("h-img");
    inner.style.width = "100%";
    inner.style.maxWidth = (dev === "mobile" ? Math.min(sc.width, 420) : sc.width) + "px";
    img.src = sc.image;
    inner.querySelectorAll(".scroll-line").forEach(e => e.remove());

    const canvas = $("h-canvas");
    canvas.width = sc.width;
    canvas.height = sc.height;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, sc.width, sc.height);

    if (hMode.value === "dots") drawDots(ctx, clicks, sc);
    else drawHeat(ctx, clicks, sc);

    if (hScroll.checked && scrollAvg != null && scrollAvg < 0.999) {
      const line = document.createElement("div");
      line.className = "scroll-line";
      line.style.top = scrollAvg * 100 + "%";
      line.innerHTML = `<span>avg scroll reached ${pct(scrollAvg)}</span>`;
      inner.appendChild(line);
    }

    const miss = clicks.filter(c => !c.hit).length;
    const testers = new Set(sessions.filter(s => s.device === dev && s.tasks.some(t => (!hTask.value || t.taskId === hTask.value) && t.path.some(p => p.screen === sc.id)))).size;
    $("h-stats").innerHTML = `
      <div class="k">Screen</div><div class="v">${esc(sc.name)}</div>
      <div class="k">Testers who saw it</div><div class="v">${testers}</div>
      <div class="k">Visits</div><div class="v">${visits.length}</div>
      <div class="k">Clicks</div><div class="v">${clicks.length}</div>
      <div class="k">Misclicks (not on a button)</div><div class="v">${clicks.length ? pct(miss / clicks.length) : "–"}</div>
      <div class="k">Average scroll depth</div><div class="v">${scrollAvg != null ? pct(scrollAvg) : "–"}</div>
      ${hMode.value === "dots"
        ? `<div class="legend"><i style="background:#2f9e44"></i>clicked a button <i style="background:#e03131;margin-left:8px"></i>misclick</div>`
        : `<div class="legend">fewer <span style="flex:1;height:10px;border-radius:5px;background:linear-gradient(90deg,#3b5bdb,#37b24d,#fcc419,#f03e3e)"></span> more</div>`}
      ${clicks.length ? "" : `<p class="muted small">No clicks recorded on this screen yet.</p>`}`;
  }

  function drawDots(ctx, clicks, sc) {
    const r = Math.max(7, sc.width * 0.012);
    clicks.forEach(c => {
      ctx.beginPath();
      ctx.arc(c.x * sc.width, c.y * sc.height, r, 0, Math.PI * 2);
      ctx.fillStyle = c.hit ? "rgba(47,158,68,.75)" : "rgba(224,49,49,.75)";
      ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = "#fff"; ctx.stroke();
    });
  }

  function drawHeat(ctx, clicks, sc) {
    if (!clicks.length) return;
    const r = Math.max(26, sc.width * 0.045);
    // 1) accumulate intensity in the alpha channel
    clicks.forEach(c => {
      const x = c.x * sc.width, y = c.y * sc.height;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, "rgba(0,0,0,0.5)");
      g.addColorStop(0.5, "rgba(0,0,0,0.25)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    });
    // 2) colourise alpha -> blue/green/yellow/red
    const pal = palette();
    const data = ctx.getImageData(0, 0, sc.width, sc.height);
    const d = data.data;
    for (let i = 0; i < d.length; i += 4) {
      const a = d[i + 3];
      if (!a) continue;
      const p = a * 4;
      d[i] = pal[p]; d[i + 1] = pal[p + 1]; d[i + 2] = pal[p + 2];
      d[i + 3] = Math.min(225, 70 + a * 1.4);
    }
    ctx.putImageData(data, 0, 0);
  }
  let _pal = null;
  function palette() {
    if (_pal) return _pal;
    const c = document.createElement("canvas"); c.width = 256; c.height = 1;
    const x = c.getContext("2d");
    const g = x.createLinearGradient(0, 0, 256, 0);
    g.addColorStop(0, "#3b5bdb"); g.addColorStop(0.35, "#37b24d"); g.addColorStop(0.65, "#fcc419"); g.addColorStop(1, "#f03e3e");
    x.fillStyle = g; x.fillRect(0, 0, 256, 1);
    return (_pal = x.getImageData(0, 0, 256, 1).data);
  }

  // ---------- testers ----------
  function renderTesters() {
    if (!sessions.length) {
      $("tester-table").innerHTML = `<tbody><tr><td class="empty">No tests yet. Open the test page and do a run-through, then press Refresh.</td></tr></tbody>`;
      return;
    }
    const fieldCols = S.fields.filter(f => f.id !== "name");
    const head = `<thead><tr><th>Name</th>${fieldCols.map(f => `<th>${esc(f.label)}</th>`).join("")}
      <th>Device</th><th>Date</th>${S.tasks.map(t => `<th>${esc(t.title)}</th>`).join("")}<th class="num">Total time</th></tr></thead>`;
    const rows = sessions.map((s, i) => {
      const cells = S.tasks.map(t => {
        const r = s.tasks.find(x => x.taskId === t.id);
        if (!r) return `<td><span class="pill prog">not reached</span></td>`;
        if (r.status === "in_progress") return `<td><span class="pill prog">left early</span></td>`;
        return `<td><span class="pill ${r.status === "success" ? "ok" : "fail"}">${r.status === "success" ? "✓ " + fmtTime(r.durationMs) : "gave up"}</span>
          <div class="stars-sm">${stars(r.rating)}</div></td>`;
      }).join("");
      const total = s.tasks.reduce((a, t) => a + (t.durationMs || 0), 0);
      const date = new Date(s.startedAt);
      return `<tr class="tester-row" data-i="${i}">
          <td><b>${esc(s.details?.name || "—")}</b>${s.completed ? "" : ' <span class="pill prog">unfinished</span>'}</td>
          ${fieldCols.map(f => `<td>${esc(s.details?.[f.id] || "–")}</td>`).join("")}
          <td>${s.device === "mobile" ? "📱 Phone" : "💻 Computer"}</td>
          <td>${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</td>
          ${cells}
          <td class="num">${fmtTime(total)}</td>
        </tr>
        <tr class="tester-detail" data-for="${i}" hidden><td colspan="${4 + fieldCols.length + S.tasks.length}">${detail(s)}</td></tr>`;
    }).join("");
    $("tester-table").innerHTML = head + "<tbody>" + rows + "</tbody>";
    $("tester-table").querySelectorAll(".tester-row").forEach(row => {
      row.addEventListener("click", () => {
        const d = $("tester-table").querySelector(`.tester-detail[data-for="${row.dataset.i}"]`);
        d.hidden = !d.hidden;
      });
    });
    $("tester-table").querySelectorAll("[data-del]").forEach(b => {
      b.addEventListener("click", (e) => {
        e.stopPropagation();
        if (b.dataset.armed) { opts.onDeleteSession(b.dataset.del); }
        else { b.dataset.armed = "1"; b.textContent = "Click again to delete"; setTimeout(() => { delete b.dataset.armed; b.textContent = "Delete this tester's results"; }, 3000); }
      });
    });
  }

  function detail(s) {
    const tasks = s.tasks.map(t => {
      const path = t.path.map(p => `<b>${esc(screenName(s.device, p.screen))}</b>${p.scrollMax && p.scrollMax < 0.999 ? ` (scrolled ${pct(p.scrollMax)})` : ""}`).join(" → ");
      const miss = t.clicks.filter(c => !c.hit).length;
      return `<div class="detail-task">
        <div><b>${esc(taskName(t.taskId))}</b> — ${t.status === "success" ? "✓ success" : t.status === "gave_up" ? "gave up" : "left early"}
          · ${fmtTime(t.durationMs)} · ${t.clicks.length} clicks (${miss} misclicks) · <span class="stars-sm">${stars(t.rating)}</span></div>
        <div class="path" style="margin-top:4px">${path}</div>
        ${t.comment ? `<div class="comment">“${esc(t.comment)}”</div>` : ""}
      </div>`;
    }).join("");
    return `<div class="detail-grid">${tasks}
      ${s.finalComment ? `<div class="detail-task"><b>Final thoughts</b><div class="comment">“${esc(s.finalComment)}”</div></div>` : ""}
      <div class="path" style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap">
        <span>Screen size ${s.env?.viewport?.w}×${s.env?.viewport?.h} · ${s.env?.touch ? "touch" : "mouse"}</span>
        ${opts.onDeleteSession ? `<button class="btn link-danger" data-del="${esc(s.id)}">Delete this tester's results</button>` : ""}
      </div></div>`;
  }

  // ---------- exports ----------
  function toCSV() {
    const fieldIds = S.fields.map(f => f.id);
    const head = ["session_id", ...fieldIds, "device", "started", "completed", ...S.tasks.flatMap(t => [`${t.id}_status`, `${t.id}_seconds`, `${t.id}_rating`, `${t.id}_clicks`, `${t.id}_misclicks`, `${t.id}_comment`]), "final_comment"];
    const q = (v) => { const x = String(v ?? ""); return /[",\n]/.test(x) ? '"' + x.replace(/"/g, '""') + '"' : x; };
    const rows = sessions.map(s => [
      s.id, ...fieldIds.map(f => s.details?.[f]), s.device, new Date(s.startedAt).toISOString(), s.completed ? "yes" : "no",
      ...S.tasks.flatMap(t => {
        const r = s.tasks.find(x => x.taskId === t.id);
        if (!r) return ["not reached", "", "", "", "", ""];
        return [r.status, r.durationMs != null ? Math.round(r.durationMs / 1000) : "", r.rating ?? "", r.clicks.length, r.clicks.filter(c => !c.hit).length, r.comment];
      }),
      s.finalComment,
    ]);
    return [head, ...rows].map(r => r.map(q).join(",")).join("\n");
  }
  function toJSON() { return JSON.stringify(sessions, null, 2); }

  return { render, toCSV, toJSON };
})();
