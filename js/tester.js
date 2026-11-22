// ============================================================
//  TESTER FLOW — welcome → device → tasks → rating → done
//  Records: path through screens, every click (hit or misclick),
//  scroll depth per screen, time per task, rating + comments.
// ============================================================
(function () {
  let S = null;            // study config (loaded from the database)
  let studyId = null;
  const $ = (id) => document.getElementById(id);
  const now = () => Date.now();
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : "s-" + now() + "-" + Math.random().toString(36).slice(2));

  let session = null;
  let device = null;       // key into S.devices
  let screensById = {};
  let taskIndex = 0;
  let task = null;         // current task result record
  let current = null;      // current screen config
  let visit = null;        // current path entry
  let rating = 0;

  // ---------- helpers ----------
  function show(viewId) {
    document.querySelectorAll(".view").forEach(v => (v.hidden = v.id !== viewId));
    window.scrollTo(0, 0);
  }
  // Save with retry: if the connection drops, keep trying in the background
  let saving = Promise.resolve();
  let saveFailed = false;
  let previewMode = false;
  function save() {
    session.updatedAt = now();
    if (previewMode) return Promise.resolve();
    try { localStorage.setItem("seek_ut_backup_" + session.id, JSON.stringify(session)); } catch (e) {}
    saving = saving.then(() => trySave(5));
    return saving;
  }
  async function trySave(attempts) {
    for (let i = 0; i < attempts; i++) {
      try {
        await DB.saveSession(session);
        saveFailed = false;
        try { localStorage.removeItem("seek_ut_backup_" + session.id); } catch (e) {}
        return true;
      } catch (err) {
        console.warn("Save failed, retrying", err);
        await new Promise(r => setTimeout(r, 1500 * (i + 1)));
      }
    }
    saveFailed = true;
    return false;
  }

  // ---------- 0. load the study ----------
  async function init() {
    if (window.DB_ERROR) return fail(window.DB_ERROR);
    const params = new URLSearchParams(location.search);
    try {
      let row;
      if (params.get("preview") && params.get("s")) {
        previewMode = true;
        row = (await DB.isAdmin()) ? await DB.getStudy(params.get("s")) : null;
        if (!row) return fail("Preview only works when you're logged in to the admin site in this browser.");
        const bar = document.createElement("div");
        bar.className = "preview-bar";
        bar.textContent = "Preview — answers are not saved";
        document.body.appendChild(bar);
      } else {
        row = await DB.getPublicStudy(params.get("s") || null);
      }
      if (!row) return fail("This user test isn't open right now. Please check the link with the person who sent it.");
      S = row.config;
      studyId = row.id;
      S.title = row.title || S.title;
      buildWelcome();
      show("view-welcome");
    } catch (err) {
      console.error(err);
      fail("Couldn't load the test. Check your internet connection and reload the page.");
    }
  }
  function fail(msg) {
    document.querySelector("#view-loading .spinner").hidden = true;
    $("loading-text").textContent = msg;
    show("view-loading");
  }

  // ---------- 1. welcome ----------
  const form = $("details-form");
  function buildWelcome() {
  $("study-title").textContent = S.title;
  $("study-intro").textContent = S.intro || "";
  document.title = S.title;
  form.innerHTML = "";
  S.fields.forEach(f => {
    const label = document.createElement("label");
    label.className = "field";
    const span = document.createElement("span");
    span.textContent = f.label + (f.required ? "" : " (optional)");
    label.appendChild(span);
    let input;
    if (f.type === "select") {
      input = document.createElement("select");
      input.appendChild(new Option("Choose…", ""));
      (f.options || []).forEach(o => input.appendChild(new Option(o, o)));
    } else {
      input = document.createElement("input");
      input.type = f.type || "text";
      if (f.type === "number") { input.min = 1; input.max = 120; input.inputMode = "numeric"; }
    }
    input.name = f.id;
    input.required = !!f.required;
    label.appendChild(input);
    form.appendChild(label);
  });
  const startBtn = document.createElement("button");
  startBtn.type = "submit";
  startBtn.className = "btn primary wide";
  startBtn.textContent = "Start";
  form.appendChild(startBtn);
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    if (session) return;
    const details = {};
    S.fields.forEach(f => (details[f.id] = form.elements[f.id].value.trim()));
    session = {
      id: uid(),
      secret: uid() + uid(),
      studyId: studyId,
      details,
      device: null,
      env: {
        userAgent: navigator.userAgent,
        viewport: { w: window.innerWidth, h: window.innerHeight },
        touch: "ontouchstart" in window || navigator.maxTouchPoints > 0,
      },
      startedAt: now(),
      updatedAt: now(),
      completed: false,
      tasks: [],
      finalComment: "",
    };
    save();
    chooseDevice();
  });

  // ---------- 2. device ----------
  function chooseDevice() {
    const keys = Object.keys(S.devices || {}).filter(k => S.devices[k] && (S.devices[k].screens || []).length);
    if (!keys.length) return fail("This test has no screens yet.");
    const looksMobile = window.matchMedia("(max-width: 767px)").matches || (session.env.touch && window.innerWidth < 1024);
    let pick = keys.includes(looksMobile ? "mobile" : "desktop") ? (looksMobile ? "mobile" : "desktop") : keys[0];
    if (keys.length === 1) return setDevice(pick);

    const box = $("device-options");
    box.innerHTML = "";
    keys.forEach(k => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "device-option";
      b.dataset.key = k;
      b.innerHTML = `<span class="device-icon">${k === "mobile" ? "📱" : "💻"}</span>
        <span class="device-name">${S.devices[k].label}</span>
        ${k === pick ? '<span class="device-tag">matches your device</span>' : ""}`;
      b.addEventListener("click", () => select(k));
      box.appendChild(b);
    });
    function select(k) {
      pick = k;
      box.querySelectorAll(".device-option").forEach(el => el.classList.toggle("selected", el.dataset.key === k));
    }
    select(pick);
    $("device-next").onclick = () => setDevice(pick);
    show("view-device");
  }

  function setDevice(k) {
    device = k;
    session.device = k;
    screensById = {};
    S.devices[k].screens.forEach(sc => {
      screensById[sc.id] = sc;
      const img = new Image(); img.src = sc.image; // preload
    });
    document.body.dataset.device = k;
    document.body.dataset.real = window.matchMedia("(max-width: 767px)").matches ? "small" : "large";
    save();
    taskIndex = 0;
    if (!S.tasks.length) return show("view-done");
    introTask();
  }

  // ---------- 3. task intro ----------
  function introTask() {
    const t = S.tasks[taskIndex];
    const label = `Task ${taskIndex + 1} of ${S.tasks.length}`;
    $("task-count").textContent = label;
    $("task-title").textContent = t.title;
    $("task-prompt").textContent = t.prompt;
    $("taskbar-count").textContent = label;
    $("taskbar-prompt").textContent = t.prompt;
    $("task-start").onclick = startTask;
    show("view-task-intro");
  }

  function startTask() {
    const t = S.tasks[taskIndex];
    task = {
      taskId: t.id,
      status: "in_progress",
      startedAt: now(),
      endedAt: null,
      durationMs: null,
      path: [],
      clicks: [],
      rating: null,
      comment: "",
    };
    session.tasks.push(task);
    show("view-test");
    goTo(S.devices[device].start);
  }

  // ---------- 4. testing ----------
  const viewport = $("viewport");
  const screenEl = $("screen");
  const img = $("screen-img");

  function goTo(screenId) {
    const sc = screensById[screenId];
    if (!sc) { console.warn("Unknown screen", screenId); return; }
    current = sc;
    img.src = sc.image;
    img.style.aspectRatio = `${sc.width} / ${sc.height}`;
    screenEl.querySelectorAll(".hotspot").forEach(h => h.remove());
    sc.hotspots.forEach(h => {
      const d = document.createElement("div");
      d.className = "hotspot";
      d.style.left = (h.x / sc.width) * 100 + "%";
      d.style.top = (h.y / sc.height) * 100 + "%";
      d.style.width = (h.w / sc.width) * 100 + "%";
      d.style.height = (h.h / sc.height) * 100 + "%";
      screenEl.appendChild(d);
    });
    viewport.scrollTop = 0;
    visit = { screen: sc.id, t: now() - task.startedAt, scrollMax: 0 };
    task.path.push(visit);
    requestAnimationFrame(updateScroll);
    if (img.complete) updateScroll(); else img.onload = updateScroll;

    const goal = S.tasks[taskIndex].goal;
    if (sc.id === goal) completeTask("success");
  }

  function updateScroll() {
    if (!visit) return;
    const max = viewport.scrollHeight;
    const pct = max > 0 ? Math.min(1, (viewport.scrollTop + viewport.clientHeight) / max) : 1;
    if (pct > visit.scrollMax) visit.scrollMax = Math.round(pct * 1000) / 1000;
  }
  viewport.addEventListener("scroll", updateScroll, { passive: true });

  screenEl.addEventListener("click", (e) => {
    if (!task || task.status !== "in_progress" || !current) return;
    const r = screenEl.getBoundingClientRect();
    const fx = (e.clientX - r.left) / r.width;
    const fy = (e.clientY - r.top) / r.height;
    const px = fx * current.width, py = fy * current.height;
    const hit = current.hotspots.find(h => px >= h.x && px <= h.x + h.w && py >= h.y && py <= h.y + h.h);
    task.clicks.push({
      screen: current.id,
      x: Math.round(fx * 10000) / 10000,
      y: Math.round(fy * 10000) / 10000,
      hit: !!hit,
      t: now() - task.startedAt,
    });
    if (hit) goTo(hit.to);
    else flashMiss(e.clientX - r.left, e.clientY - r.top);
  });

  function flashMiss(x, y) {
    const d = document.createElement("div");
    d.className = "tap-ripple";
    d.style.left = x + "px"; d.style.top = y + "px";
    screenEl.appendChild(d);
    setTimeout(() => d.remove(), 500);
  }

  $("taskbar-toggle").addEventListener("click", (e) => {
    const bar = e.currentTarget.closest(".taskbar");
    const open = bar.classList.toggle("open");
    e.currentTarget.setAttribute("aria-expanded", open);
  });

  // Two-tap give up (no pop-up dialogs, which some browsers block)
  const giveUp = $("give-up");
  let giveUpTimer = null;
  giveUp.addEventListener("click", () => {
    if (!task || task.status !== "in_progress") return;
    if (giveUp.classList.contains("confirm")) {
      clearTimeout(giveUpTimer);
      resetGiveUp();
      completeTask("gave_up");
    } else {
      giveUp.classList.add("confirm");
      giveUp.textContent = "Tap again to skip";
      giveUpTimer = setTimeout(resetGiveUp, 3000);
    }
  });
  function resetGiveUp() { giveUp.classList.remove("confirm"); giveUp.textContent = "Give up"; }

  function completeTask(status) {
    task.status = status;
    task.endedAt = now();
    task.durationMs = task.endedAt - task.startedAt;
    save();
    if (status === "success") {
      const toast = $("success-toast");
      toast.hidden = false;
      setTimeout(() => { toast.hidden = true; askRating(); }, 1100);
    } else askRating();
  }

  // ---------- 5. rating ----------
  const starBox = $("stars");
  const hints = ["", "Very hard", "Hard", "OK", "Easy", "Very easy"];
  for (let i = 1; i <= 5; i++) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "star";
    b.textContent = "★";
    b.setAttribute("aria-label", i + " star" + (i > 1 ? "s" : ""));
    b.addEventListener("click", () => setRating(i));
    starBox.appendChild(b);
  }
  function setRating(n) {
    rating = n;
    starBox.querySelectorAll(".star").forEach((s, i) => s.classList.toggle("on", i < n));
    $("star-hint").textContent = hints[n];
    $("rate-next").disabled = false;
  }

  function askRating() {
    rating = 0;
    starBox.querySelectorAll(".star").forEach(s => s.classList.remove("on"));
    $("star-hint").textContent = "Tap a star";
    $("rate-next").disabled = true;
    $("rate-comment").value = "";
    $("rate-status").textContent = task.status === "success" ? "Task complete" : "Task skipped";
    $("rate-question").textContent = S.ratingQuestion;
    show("view-rate");
  }

  $("rate-next").addEventListener("click", () => {
    task.rating = rating;
    task.comment = $("rate-comment").value.trim();
    save();
    taskIndex++;
    if (taskIndex < S.tasks.length) introTask();
    else show("view-done");
  });

  // ---------- 6. done ----------
  $("finish").addEventListener("click", async () => {
    session.finalComment = $("final-comment").value.trim();
    session.completed = true;
    session.endedAt = now();
    $("finish").disabled = true;
    $("finish").textContent = "Saving…";
    await save();
    $("final-form").hidden = true;
    $("thanks").hidden = false;
    if (saveFailed) $("thanks-text").textContent = "We couldn't reach the server, so your answers may not have been saved. Please keep this page open, check your connection and press Finish again.";
    if (saveFailed) { $("final-form").hidden = false; $("thanks").hidden = true; $("finish").disabled = false; $("finish").textContent = "Try again"; alertBox("Couldn't save — check your connection and press Try again."); }
  });

  function alertBox(msg) {
    let el = document.getElementById("save-warning");
    if (!el) { el = document.createElement("p"); el.id = "save-warning"; el.className = "warn-text"; $("final-form").appendChild(el); }
    el.textContent = msg;
  }

  init();
})();
