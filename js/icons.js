// Simple line icons (SF Symbols-style), drawn with currentColor.
(function () {
  const p = (d, extra = "") => `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"${extra}>${d}</svg>`;
  const I = {
    phone: p('<rect x="6.5" y="2.5" width="11" height="19" rx="2.8"/><path d="M10.5 18.5h3"/>'),
    laptop: p('<rect x="4" y="4.5" width="16" height="11" rx="1.8"/><path d="M2 19.5h20"/>'),
    check: p('<path d="M5 12.5l4.5 4.5L19 7.5"/>', ' stroke-width="2.6"'),
    chart: p('<path d="M4 20V10M10 20V4M16 20v-7M21 20H3"/>'),
    edit: p('<path d="M14.5 5.5l4 4M4 20l1-5L15.5 4.5a2.1 2.1 0 013 0l1 1a2.1 2.1 0 010 3L9 19z"/>'),
    link: p('<path d="M10 14a4.5 4.5 0 006.4 0l3-3a4.5 4.5 0 00-6.4-6.4l-1 1"/><path d="M14 10a4.5 4.5 0 00-6.4 0l-3 3a4.5 4.5 0 006.4 6.4l1-1"/>'),
    more: p('<circle cx="5.5" cy="12" r="1.2" fill="currentColor"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/><circle cx="18.5" cy="12" r="1.2" fill="currentColor"/>'),
    plus: p('<path d="M12 5v14M5 12h14"/>', ' stroke-width="2.2"'),
    back: p('<path d="M15 5l-7 7 7 7"/>', ' stroke-width="2.2"'),
    up: p('<path d="M12 19V5M6 11l6-6 6 6"/>'),
    down: p('<path d="M12 5v14M6 13l6 6 6-6"/>'),
    x: p('<path d="M6 6l12 12M18 6L6 18"/>'),
    external: p('<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h5"/>'),
    copy: p('<rect x="8" y="8" width="12" height="12" rx="2.5"/><path d="M16 8V6a2 2 0 00-2-2H6a2 2 0 00-2 2v8a2 2 0 002 2h2"/>'),
    trash: p('<path d="M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13"/>'),
    star: p('<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.8z"/>'),
    upload: p('<path d="M12 16V4M7 9l5-5 5 5M4 16v3a1 1 0 001 1h14a1 1 0 001-1v-3"/>'),
    eye: p('<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>'),
    refresh: p('<path d="M20 11a8 8 0 10-2.3 5.7M20 4v7h-7"/>'),
    download: p('<path d="M12 4v12M7 11l5 5 5-5M4 20h16"/>'),
    duplicate: p('<rect x="8" y="8" width="12" height="12" rx="2.5"/><path d="M14 11v6M11 14h6M16 8V6a2 2 0 00-2-2H6a2 2 0 00-2 2v8a2 2 0 002 2h2"/>'),
    tap: p('<path d="M9 11V5.5a1.5 1.5 0 013 0V11m0-1.5a1.5 1.5 0 013 0V12m0-1a1.5 1.5 0 013 0v3.5a6 6 0 01-6 6h-.5a6 6 0 01-4.9-2.5l-2.4-3.4a1.5 1.5 0 012.3-1.9L9 14.5V11"/>'),
    logout: p('<path d="M15 4h3a2 2 0 012 2v12a2 2 0 01-2 2h-3M10 16l-4-4 4-4M6 12h10"/>'),
    lock: p('<rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8 10.5V7.5a4 4 0 018 0v3"/>'),
    grid: p('<rect x="4" y="4" width="7" height="7" rx="2"/><rect x="13" y="4" width="7" height="7" rx="2"/><rect x="4" y="13" width="7" height="7" rx="2"/><rect x="13" y="13" width="7" height="7" rx="2"/>'),
  };
  window.ICONS = I;
  window.icon = (name) => I[name] || "";
})();
