/* =====================================================================
   Oslr site interactions.
   Motion rules (Emil Kowalski): transform + opacity only, ease-out for
   enter, ease-in-out for on-screen movement, nothing animates on
   high-frequency or keyboard actions, everything is interruptible,
   reduced motion keeps fades and drops movement. Content is complete at
   rest: anything hidden for an entrance is only hidden when it starts
   below the fold.
   ===================================================================== */
(function () {
  "use strict";
  var doc = document.documentElement;
  doc.classList.add("js");
  var RM = window.matchMedia("(prefers-reduced-motion: reduce)");
  var reduce = function () { return RM.matches; };
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var belowFold = function (el) { return el.getBoundingClientRect().top > window.innerHeight * 0.92; };
  var onView = function (el, cb, opts) {
    if (!("IntersectionObserver" in window)) { cb(); return; }
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { io.disconnect(); cb(); } });
    }, opts || { rootMargin: "0px 0px -12% 0px" });
    io.observe(el);
  };
  var cfg = window.OSLR || {};

  /* ---------- config links ---------- */
  if (cfg.links) {
    $$("[data-link]").forEach(function (a) {
      var k = a.getAttribute("data-link");
      if (cfg.links[k]) a.setAttribute("href", cfg.links[k]);
    });
  }

  /* ---------- nav ---------- */
  var nav = $(".nav");
  if (nav) {
    var stuck = function () { nav.classList.toggle("is-stuck", window.scrollY > 8); };
    stuck();
    window.addEventListener("scroll", stuck, { passive: true });
    var menuBtn = $(".nav__menu");
    var sheet = $(".sheet");
    var setOpen = function (open) {
      if (open) nav.setAttribute("data-open", ""); else nav.removeAttribute("data-open");
      menuBtn.setAttribute("aria-expanded", open ? "true" : "false");
      sheet.setAttribute("aria-hidden", open ? "false" : "true");
      document.body.style.overflow = open ? "hidden" : "";
      if (open) { var f = $("a", sheet); if (f) f.focus({ preventScroll: true }); }
    };
    if (menuBtn && sheet) {
      menuBtn.addEventListener("click", function () { setOpen(!nav.hasAttribute("data-open")); });
      document.addEventListener("keydown", function (e) {
        if (e.key === "Escape" && nav.hasAttribute("data-open")) { setOpen(false); menuBtn.focus(); }
      });
      $$("a", sheet).forEach(function (a) { a.addEventListener("click", function () { setOpen(false); }); });
      window.addEventListener("resize", function () { if (window.innerWidth >= 960) setOpen(false); });
    }
  }

  /* ---------- scroll reveal (once, below the fold only) ---------- */
  $$("[data-reveal]").forEach(function (el) {
    if (!belowFold(el)) return;
    el.classList.add("pre");
    onView(el, function () {
      requestAnimationFrame(function () { el.classList.add("in"); el.classList.remove("pre"); });
    });
  });

  /* ---------- hero video ---------- */
  var vwin = $(".window--video");
  var video = vwin && $("video", vwin);
  if (video) {
    var small = window.matchMedia("(max-width: 700px)").matches;
    var src = video.getAttribute(small ? "data-src-sm" : "data-src");
    var ctl = $(".vctl", vwin);
    var userPaused = false;
    var setPaused = function (p) { if (ctl) ctl.setAttribute("aria-pressed", p ? "true" : "false"); if (ctl) $(".vctl__t", ctl).textContent = p ? "Play" : "Pause"; };
    if (src) { video.src = src; }
    if (reduce()) { video.removeAttribute("autoplay"); video.pause(); setPaused(true); userPaused = true; }
    else { var pr = video.play(); if (pr && pr.catch) pr.catch(function () { setPaused(true); }); }
    if (ctl) ctl.addEventListener("click", function () {
      if (video.paused) { userPaused = false; video.play(); setPaused(false); }
      else { userPaused = true; video.pause(); setPaused(true); }
    });
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (es) {
        es.forEach(function (e) {
          if (userPaused) return;
          if (e.isIntersecting) { var p = video.play(); if (p && p.catch) p.catch(function () {}); } else video.pause();
        });
      }, { threshold: 0.15 }).observe(video);
    }
  }

  /* ---------- specialty tree: pick a subspecialty, its focus areas branch from it ---------- */
  var t4 = $(".t4");
  if (t4) {
    var TF = JSON.parse(t4.getAttribute("data-focus")), NY = t4.getAttribute("data-ny").split(",").map(Number);
    var tn = $$(".t4__n", t4), tsp = $$(".t4__svg .sp", t4), tlk = $$(".t4__svg .lk", t4), tch = $$(".t4__f", t4), ti = -1, ttm;
    var FX = 420, H4 = 300;
    var pick = function (i) {
      if (i === ti) return;
      ti = i;
      tn.forEach(function (n, k) { n.classList.toggle("on", k === i); });
      tsp.forEach(function (p, k) { p.classList.toggle("on", k === i); });
      var y = NY[i], ys = [y - 52, y, y + 52], NX = (tn[i].offsetLeft + tn[i].offsetWidth) / t4.clientWidth * 600;
      if (ys[0] < 34) ys = [34, 86, 138];
      if (ys[2] > H4 - 34) ys = [H4 - 138, H4 - 86, H4 - 34];
      tlk.forEach(function (p, k) {
        var mx = (NX + FX) / 2;
        p.setAttribute("d", "M" + NX + " " + y + " C " + mx + " " + y + ", " + mx + " " + ys[k] + ", " + FX + " " + ys[k]);
      });
      clearTimeout(ttm);
      t4.classList.add("swap");
      ttm = setTimeout(function () {
        tch.forEach(function (c, k) { c.textContent = TF[i][k]; c.style.top = (ys[k] / H4 * 100) + "%"; });
        t4.classList.remove("swap");
      }, reduce() ? 0 : 150);
    };
    tn.forEach(function (n, i) {
      n.addEventListener("pointerdown", function () { pick(i); });
      n.addEventListener("focus", function () { pick(i); });
      if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) n.addEventListener("mouseenter", function () { pick(i); });
    });
    var start = Math.max(0, tn.findIndex(function (n) { return n.classList.contains("on"); }));
    pick(start);
  }

  /* interest panel: the highlights sweep in once, in reading order */
  var pi = $(".pi");
  if (pi && belowFold(pi) && !reduce()) { pi.classList.add("pre"); onView(pi, function () { requestAnimationFrame(function () { pi.classList.remove("pre"); }); }); }

  /* ---------- live search conversation ---------- */
  var cx = $(".cx");
  if (cx) {
    var S = [
      { q: "Find me private practice plastic surgeons in LA.", n: "128 candidates", sub: "Plastic surgery in private practice, Los Angeles", chips: ["Plastic surgery", "Private practice", "Attending surgeons", "Los Angeles metro"], res: [
        ["Dr. Elena Vasquez", "elena-vasquez", 18, "Plastic Surgeon", ["WP", "#3B5B7A", "Westside Plastic Surgery Group"], "Beverly Hills, CA", ["Private practice", "Breast reconstruction"], "Board-certified plastic surgeon in a four-surgeon private group, focused on reconstructive breast surgery."],
        ["Dr. Victor Chen", "victor-chen", 24, "Plastic and Reconstructive Surgeon", ["PA", "#6B4E8C", "Pacific Aesthetic Institute"], "Santa Monica, CA", ["Private practice", "Facial plastics"], "Owner and lead surgeon at a private practice, with a facial aesthetics and rhinoplasty focus."],
        ["Dr. Sarah Okonkwo", "sarah-okonkwo", 12, "Plastic Surgeon", ["CP", "#2E6B5E", "Coastal Plastic Surgery"], "Pasadena, CA", ["Private practice", "Hand surgery"], "Plastic surgeon in private practice since 2019, with a hand and microsurgery fellowship."]] },
      { q: "Find me student nurse anesthetists (SRNAs) in South Florida.", n: "46 candidates", sub: "Student nurse anesthetists, South Florida", chips: ["Student nurse anesthetists", "Nurse anesthesia programs", "Miami to West Palm Beach"], res: [
        ["Daniela Ortiz", "daniela-ortiz", 6, "Student Registered Nurse Anesthetist", ["UM", "#005030", "University of Miami"], "Miami, FL", ["SRNA", "Graduating 2027"], "Second-year SRNA with four years of ICU nursing before anesthesia school."],
        ["Kevin Brooks", "kevin-brooks", 8, "SRNA, Nurse Anesthesia Program", ["FI", "#081E3F", "Florida International University"], "Miami, FL", ["SRNA", "Graduating 2026"], "Final-year SRNA with cardiac ICU experience, completing clinical rotations in Broward County."],
        ["Alyssa Romero", "alyssa-romero", 5, "Student Nurse Anesthetist", ["BU", "#9E1B32", "Barry University"], "Miami Shores, FL", ["SRNA", "Graduating 2027"], "SRNA with a background in trauma ICU nursing at a Level I trauma center."]] },
      { q: "Find me cardiology fellows in Texas finishing next year.", n: "71 candidates", sub: "Cardiovascular disease fellows, Texas", chips: ["Cardiovascular disease", "Fellows", "Final year of fellowship", "Texas"], res: [
        ["Dr. Rahul Mehta", "rahul-mehta", 9, "Cardiology Fellow", ["UT", "#BF5700", "UT Southwestern Medical Center"], "Dallas, TX", ["Fellow", "Finishing 2027"], "Third-year cardiovascular disease fellow with an interest in heart failure."],
        ["Dr. Jessica Park", "jessica-park", 8, "Cardiovascular Disease Fellow", ["BC", "#1F3A68", "Baylor College of Medicine"], "Houston, TX", ["Fellow", "Finishing 2027"], "Final-year fellow focused on cardiac imaging, matched to an imaging year."],
        ["Dr. Andre Williams", "andre-williams", 10, "Cardiology Fellow", ["HM", "#3A5DAE", "Houston Methodist"], "Houston, TX", ["Fellow", "Finishing 2027"], "Fellow with an interventional focus, finishing general cardiology training next summer."]] },
      { q: "Find me ICU nurses with CCRN near Chicago.", n: "312 candidates", sub: "ICU nurses with CCRN, Chicago metro", chips: ["Registered nurses", "Intensive care unit", "CCRN", "Chicago metro"], res: [
        ["Megan Sullivan, RN", "megan-sullivan", 11, "ICU Registered Nurse", ["NM", "#4E2A84", "Northwestern Medicine"], "Chicago, IL", ["CCRN", "Medical ICU"], "Medical ICU nurse for six years, CCRN certified, charge nurse on nights."],
        ["Jordan Ellis, RN", "jordan-ellis", 7, "Critical Care Nurse", ["RU", "#00573F", "Rush University Medical Center"], "Chicago, IL", ["CCRN", "Cardiac ICU"], "Cardiac ICU nurse with CCRN, precepting new graduate nurses."],
        ["Priya Nair, RN", "priya-nair", 9, "Registered Nurse, Surgical ICU", ["UC", "#800000", "UChicago Medicine"], "Chicago, IL", ["CCRN", "Surgical ICU"], "Surgical ICU nurse with CCRN and a trauma critical care background."]] }
    ];
    var T = ["#E3ECFA:#2A4A86", "#E1F2EA:#1F6A4F", "#F7E9DC:#8A4A1A", "#F4E3EC:#8A2A5B", "#E0EEF6:#1F5A80", "#F3F0D9:#6E6216", "#ECE5F7:#5A3A8F"];
    var e2 = function (s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;"); };
    var spark = "";
    var items = $$(".cx__item", cx), you = $(".cx__you p", cx), status = $(".cx__status", cx), chipsEl = $(".cx__chips", cx), resEl = $(".cx__res", cx);
    var youWrap = $(".cx__you", cx), typed = $(".cx__typed", cx), send = $(".cx__send", cx), ph = $(".cx__ph", cx);
    var setTyped = function (t) { typed.textContent = t; if (ph) ph.style.display = t ? "none" : ""; };
    var cur = 0, timers = [], auto = true, visible = false, raf, t0 = 0, dur = 0, run = 0;
    var later = function (fn, ms) { timers.push(setTimeout(fn, ms)); };
    var clear = function () { timers.forEach(clearTimeout); timers = []; cancelAnimationFrame(raf); };
    var PIN = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M20 10c0 5-8 12-8 12s-8-7-8-12a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/></svg>';
    var root = (document.querySelector('link[href$="assets/css/oslr.css"]') || { getAttribute: function () { return "assets/css/oslr.css"; } }).getAttribute("href").replace("assets/css/oslr.css", "");
    var card = function (r) {
      return '<div class="cand in-pre"><img class="av av--img" src="' + root + 'assets/img/people/' + r[1] + '.jpg" alt="" width="40" height="40">' +
        '<div class="cand__top"><div><div class="cand__name">' + e2(r[0]) + ' <span class="li" aria-label="LinkedIn">in</span></div><div class="cand__exp">' + r[2] + 'y experience</div></div>' +
        '<div class="cand__role"><b>' + e2(r[3]) + '</b><span class="org"><i style="background:' + r[4][1] + '">' + r[4][0] + '</i><span>' + e2(r[4][2]) + '</span></span> <span class="org">' + PIN + '<span>' + e2(r[5]) + '</span></span></div>' +
        '<div class="cand__tags">' + r[6].map(function (t, k) { return '<span class="pt' + (k === 0 ? ' pt--sea' : '') + '">' + e2(t) + '</span>'; }).join("") + '</div>' +
        '<span class="status">Unreviewed</span></div>' +
        '<div class="cand__ai">' + spark + '<span>' + e2(r[7]) + '</span></div></div>';
    };
    var head = function (P) { return '<div class="cx__rh"><h4>' + e2(P.n) + '</h4><p>' + e2(P.sub) + '</p></div>'; };
    var reveal = function (els, gap, start) { els.forEach(function (el, k) { later(function () { el.classList.add("in-go"); }, start + k * gap); }); };
    var progress = function () {
      var bar = items[cur];
      var tick = function (t) {
        var k = Math.min(1, (t - t0) / dur);
        bar.style.setProperty("--p", k.toFixed(4));
        if (k < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    };
    var renderFinal = function (i) {
      var P = S[i];
      you.textContent = P.q; youWrap.classList.remove("in-pre");
      status.classList.remove("busy");
      chipsEl.innerHTML = P.chips.map(function (c) { return "<span>" + e2(c) + "</span>"; }).join("");
      resEl.innerHTML = head(P) + '<div class="ui__list">' + P.res.map(card).join("").replace(/ in-pre/g, "") + "</div>";
      setTyped(""); typed.classList.remove("caret-on"); send.classList.remove("ready");
    };
    var play = function (i, fromClick) {
      clear(); run++; var me = run;
      cur = i;
      items.forEach(function (b, k) { b.classList.toggle("on", k === i); b.setAttribute("aria-selected", k === i ? "true" : "false"); b.style.setProperty("--p", k === i ? 0 : 0); });
      if (reduce()) { renderFinal(i); return; }
      var P = S[i];
      /* clear the thread */
      youWrap.classList.add("in-pre"); youWrap.classList.remove("in-go");
      status.classList.add("in-pre"); status.classList.remove("in-go");
      chipsEl.innerHTML = ""; resEl.innerHTML = "";
      setTyped(""); typed.classList.add("caret-on"); send.classList.remove("ready");
      /* type into the composer */
      var n = 0, step = 28;
      var type = function () {
        if (me !== run) return;
        n++; setTyped(P.q.slice(0, n));
        if (n === 1) send.classList.add("ready");
        if (n < P.q.length) later(type, step); else later(sendIt, 380);
      };
      var sendIt = function () {
        send.classList.add("press"); later(function () { send.classList.remove("press"); }, 140);
        setTyped(""); typed.classList.remove("caret-on"); send.classList.remove("ready");
        you.textContent = P.q;
        later(function () { youWrap.classList.add("in-go"); }, 60);
        later(function () { status.classList.add("busy", "in-go"); }, 420);
        later(function () {
          status.classList.remove("busy");
          chipsEl.innerHTML = P.chips.map(function (c) { return '<span class="in-pre">' + e2(c) + "</span>"; }).join("");
          reveal($$("span", chipsEl), 110, 30);
          resEl.innerHTML = head(P).replace('cx__rh"', 'cx__rh in-pre"') + '<div class="ui__list">' + P.res.map(card).join("") + "</div>";
          reveal($$(".cx__rh, .cand", resEl), 150, 30 + P.chips.length * 110 + 120);
        }, 1300);
      };
      later(type, fromClick ? 120 : 500);
      /* progress spans the whole run plus a reading pause */
      dur = 600 + P.q.length * step + 380 + 1300 + P.chips.length * 110 + 3 * 170 + 5200;
      t0 = performance.now(); progress();
      later(function () { if (auto && visible && me === run) play((i + 1) % S.length); }, dur);
    };
    items.forEach(function (b, i) { b.addEventListener("click", function () { auto = false; items.forEach(function (x) { x.style.setProperty("--p", 0); }); play(i, true); }); });
    renderFinal(0);
    if (!reduce() && "IntersectionObserver" in window) {
      var started = false;
      new IntersectionObserver(function (es) {
        es.forEach(function (e) {
          visible = e.isIntersecting;
          if (visible && !started) { started = true; play(0); }
          else if (visible && auto && !timers.length) play(cur);
          else if (!visible) { clear(); renderFinal(cur); }
        });
      }, { threshold: 0.35 }).observe(cx);
    }
  }

  /* ---------- "Oslr reads your search" ---------- */
  var parse = $(".parse");
  if (parse) {
    var Q = [
      { q: "Find PGY-5 orthopedic residents in New York City with an interest in sports medicine.", rows: [["PGY-5", "Fifth year of residency", "started June 2022"], ["orthopedic", "Orthopedic surgery", "orthopedic or orthopaedic"], ["residents", "In residency training now", ""], ["New York City", "All five boroughs", ""], ["interest in sports medicine", "Sports medicine interest", "from About, residency and previous roles"]] },
      { q: "ICU nurses with BSN near Chicago.", rows: [["ICU", "Intensive care unit", "medical, surgical, cardiac, neuro"], ["nurses", "Registered nurses", ""], ["BSN", "Bachelor of Science in Nursing", ""], ["near Chicago", "Chicago metro area", ""]] },
      { q: "Private practice sports medicine surgeons in Nashville.", rows: [["Private practice", "Independent and private groups", ""], ["sports medicine", "Sports medicine", "not general orthopedics"], ["surgeons", "Orthopedic surgeons", ""], ["Nashville", "Nashville, Tennessee", ""]] },
      { q: "Current cardiology fellows in Texas.", rows: [["Current", "In training today", "by fellowship start date"], ["cardiology", "Cardiovascular disease", ""], ["fellows", "Fellowship after residency", ""], ["Texas", "Statewide", ""]] }
    ];
    var qEl = $(".parse__q", parse), rowsEl = $(".parse__rows", parse), tabs = $$(".parse__tabs .chip", parse);
    var timer = null, idx = 0, auto = false, inView = false, running = 0;
    var esc = function (s) { return s.replace(/&/g, "&amp;").replace(/</g, "&lt;"); };
    var renderRows = function (P) {
      rowsEl.innerHTML = P.rows.map(function (r) {
        return '<div class="prow"><div class="prow__k"><span>' + esc(r[0]) + '</span></div><div class="prow__ar" aria-hidden="true">&rarr;</div><div class="prow__v">' + esc(r[1]) + (r[2] ? ' <em>' + esc(r[2]) + '</em>' : '') + '</div></div>';
      }).join("");
    };
    var markup = function (P, upto, lit) {
      var txt = P.q.slice(0, upto), out = esc(txt);
      P.rows.forEach(function (r, j) {
        var k = esc(r[0]);
        if (out.indexOf(k) > -1) out = out.replace(k, '<mark class="' + (j < lit ? "on" : "") + '">' + k + "</mark>");
      });
      return out;
    };
    var setTab = function (i) { tabs.forEach(function (t, j) { t.setAttribute("aria-pressed", j === i ? "true" : "false"); }); };
    var show = function (i, animate) {
      var run = ++running;
      idx = i; setTab(i);
      var P = Q[i];
      clearTimeout(timer);
      renderRows(P);
      var rows = $$(".prow", rowsEl);
      if (!animate || reduce()) {
        qEl.innerHTML = markup(P, P.q.length, P.rows.length);
        rows.forEach(function (r) { r.classList.add("on"); });
        queue();
        return;
      }
      var n = 0;
      var type = function () {
        if (run !== running) return;
        n = Math.min(P.q.length, n + 1);
        qEl.innerHTML = markup(P, n, 0) + '<span class="caret" aria-hidden="true"></span>';
        if (n < P.q.length) { timer = setTimeout(type, 26); }
        else { timer = setTimeout(function () { light(0); }, 260); }
      };
      var light = function (j) {
        if (run !== running) return;
        qEl.innerHTML = markup(P, P.q.length, j + 1);
        if (rows[j]) rows[j].classList.add("on");
        if (j + 1 < P.rows.length) timer = setTimeout(function () { light(j + 1); }, 170);
        else queue();
      };
      type();
    };
    var queue = function () {
      clearTimeout(timer);
      if (!auto || !inView || reduce()) return;
      var run = running;
      timer = setTimeout(function () { if (run === running) show((idx + 1) % Q.length, true); }, 4200);
    };
    tabs.forEach(function (t, i) { t.addEventListener("click", function () { auto = false; show(i, true); }); });
    $$("[data-parse]").forEach(function (b) {
      b.addEventListener("click", function () {
        var i = +b.getAttribute("data-parse");
        auto = false;
        parse.scrollIntoView({ behavior: reduce() ? "auto" : "smooth", block: "center" });
        setTimeout(function () { show(i, true); }, reduce() ? 0 : 450);
      });
    });
    if ("IntersectionObserver" in window) {
      var first = true;
      new IntersectionObserver(function (es) {
        es.forEach(function (e) {
          inView = e.isIntersecting;
          if (inView && first) { first = false; show(0, true); }
          else if (inView) queue(); else clearTimeout(timer);
        });
      }, { threshold: 0.4 }).observe(parse);
    }
  }

  /* ---------- same title, different year ---------- */
  var tl = $(".tl");
  if (tl) {
    var sw = $("#tl-focus");
    var setFocus = function (on) { tl.classList.toggle("focus", on); if (sw) sw.checked = on; var c = $(".tl__count"); if (c) c.textContent = on ? c.getAttribute("data-on") : c.getAttribute("data-off"); };
    if (sw) sw.addEventListener("change", function () { setFocus(sw.checked); });
    if (belowFold(tl) && !reduce() && !matchMedia("(max-width: 760px)").matches) {
      tl.classList.add("pre");
      setFocus(false);
      onView(tl, function () {
        requestAnimationFrame(function () {
          tl.classList.remove("pre");
          setTimeout(function () { setFocus(true); }, 1500);
        });
      });
    } else { setFocus(true); }
  }

  /* ---------- role roller ---------- */
  var roller = $(".roller");
  if (roller) {
    var list = $("ul", roller), items = $$("li", roller), ri = 0, rt;
    var h = function () { return items[0].getBoundingClientRect().height; };
    var place = function () { list.style.transform = "translateY(" + (-ri * h()) + "px)"; items.forEach(function (li, j) { li.classList.toggle("on", j === ri); }); };
    var step = function () { ri = (ri + 1) % items.length; place(); };
    place();
    window.addEventListener("resize", place);
    if (!reduce() && "IntersectionObserver" in window) {
      new IntersectionObserver(function (es) {
        es.forEach(function (e) { clearInterval(rt); if (e.isIntersecting) rt = setInterval(step, 1800); });
      }).observe(roller);
    }
  }

  /* ---------- counters (rare, explanatory) ---------- */
  $$("[data-count]").forEach(function (el) {
    if (!belowFold(el) || reduce()) return;
    var target = parseFloat(el.getAttribute("data-count")), dec = (el.getAttribute("data-count").split(".")[1] || "").length;
    var pre = el.getAttribute("data-pre") || "", suf = el.getAttribute("data-suf") || "";
    var final = el.textContent;
    el.textContent = pre + (0).toFixed(dec) + suf;
    onView(el, function () {
      var t0 = performance.now(), D = 1100;
      var tick = function (t) {
        var k = Math.min(1, (t - t0) / D), e = 1 - Math.pow(1 - k, 4);
        el.textContent = pre + (target * e).toFixed(dec) + suf;
        if (k < 1) requestAnimationFrame(tick); else el.textContent = final;
      };
      requestAnimationFrame(tick);
    });
  });

  /* ---------- sticky workflow ---------- */
  var flow = $(".flow");
  if (flow && "IntersectionObserver" in window) {
    var steps = $$(".flow__step", flow), wins = $$(".flow__stage .window", flow);
    var setStep = function (i) {
      steps.forEach(function (s, j) { s.classList.toggle("on", j === i); });
      wins.forEach(function (w, j) { w.classList.toggle("on", j === i); w.setAttribute("aria-hidden", j === i ? "false" : "true"); });
    };
    var io2 = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) setStep(steps.indexOf(e.target)); });
    }, { rootMargin: "-45% 0px -45% 0px" });
    steps.forEach(function (s) { io2.observe(s); });
    var line = $(".flow__line i", flow), lt = false;
    if (line) {
      var fill = function () {
        lt = false;
        var r = $(".flow__steps", flow).getBoundingClientRect(), mid = window.innerHeight * 0.5;
        var k = Math.min(1, Math.max(0, (mid - r.top) / r.height));
        line.style.setProperty("--p", k.toFixed(4));
      };
      fill();
      window.addEventListener("scroll", function () { if (!lt) { lt = true; requestAnimationFrame(fill); } }, { passive: true });
    }
  }

  /* ---------- pricing ---------- */
  var seg = $(".seg");
  if (seg && cfg.pricing) {
    var P2 = cfg.pricing, btns = $$("button", seg), ind = $(".seg__ind", seg);
    var money = function (n) { return "$" + n.toLocaleString("en-US"); };
    var moveInd = function (b) { ind.style.width = b.offsetWidth + "px"; ind.style.transform = "translateX(" + (b.offsetLeft - 4) + "px)"; };
    var apply = function (annual, animate) {
      btns.forEach(function (b) { b.setAttribute("aria-pressed", (b.getAttribute("data-bill") === "annual") === annual ? "true" : "false"); });
      moveInd(btns.filter(function (b) { return b.getAttribute("aria-pressed") === "true"; })[0]);
      ["starter", "pro"].forEach(function (k) {
        var pl = P2.plans[k]; if (!pl) return;
        var yr = Math.round(pl.monthly * 12 * (1 - P2.annualDiscount));
        var mo = P2.roundMonthly ? Math.round(pl.monthly * (1 - P2.annualDiscount)) : +(pl.monthly * (1 - P2.annualDiscount)).toFixed(2);
        var amt = $('[data-price="' + k + '"]'), note = $('[data-note="' + k + '"]');
        var txt = annual ? money(mo) : money(pl.monthly);
        var nt = annual ? "Billed " + money(yr) + " a year" : "Billed monthly";
        if (!amt) return;
        if (!animate || reduce() || amt.textContent === txt) { amt.textContent = txt; note.textContent = nt; return; }
        amt.classList.add("swap");
        setTimeout(function () { amt.textContent = txt; note.textContent = nt; amt.classList.remove("swap"); }, 150);
      });
      ["starter", "pro"].forEach(function (k) { var c = $('[data-credits="' + k + '"]'); if (c && P2.plans[k]) c.textContent = P2.plans[k].credits.toLocaleString("en-US"); });
    };
    btns.forEach(function (b) { b.addEventListener("click", function () { apply(b.getAttribute("data-bill") === "annual", true); }); });
    var initAnnual = btns.some(function (b) { return b.getAttribute("data-bill") === "annual" && b.getAttribute("aria-pressed") === "true"; });
    apply(initAnnual, false);
    window.addEventListener("resize", function () { moveInd(btns.filter(function (b) { return b.getAttribute("aria-pressed") === "true"; })[0]); });
    requestAnimationFrame(function () { ind.style.transition = "none"; moveInd(btns.filter(function (b) { return b.getAttribute("aria-pressed") === "true"; })[0]); requestAnimationFrame(function () { ind.style.transition = ""; }); });
  }

  /* credit calculator: credits needed on each plan, using each plan's prices */
  var calc = $(".calc");
  if (calc && cfg.pricing) {
    var C = cfg.pricing.creditCost, PL = cfg.pricing.plans, ins = $$("input[type=range]", calc);
    var cost = function (k, w, pe, ph) { var c = C[k] || C; return w * c.workEmail + pe * c.personalEmail + ph * c.phone; };
    var update = function () {
      var w = +$("#c-work").value, pe = +$("#c-personal").value, ph = +$("#c-phone").value;
      ins.forEach(function (i) { var p = (i.value - i.min) / (i.max - i.min) * 100; i.style.setProperty("--p", p + "%"); });
      $("#o-work").textContent = w; $("#o-personal").textContent = pe; $("#o-phone").textContent = ph;
      var fits = [];
      ["starter", "pro"].forEach(function (k) {
        var need = cost(k, w, pe, ph), cap = PL[k].credits, el = $("#o-" + k), bar = $("#b-" + k);
        if (el) el.textContent = need.toLocaleString("en-US");
        if (bar) bar.style.transform = "scaleX(" + Math.min(1, need / cap) + ")";
        var box = $('.calc__plan[data-plan="' + k + '"]'); if (box) box.classList.toggle("over", need > cap);
        if (need <= cap) fits.push(k);
      });
      $("#o-fit").innerHTML = fits.length ? "Fits in <strong>" + (fits[0] === "starter" ? "Starter" : "Pro") + "</strong>" : "Above Pro. <strong>Enterprise</strong> sets volume to your team";
    };
    ins.forEach(function (i) { i.addEventListener("input", update); });
    update();
  }

  /* ---------- FAQ ---------- */
  $$(".faq__q").forEach(function (q) {
    q.addEventListener("click", function () { q.setAttribute("aria-expanded", q.getAttribute("aria-expanded") === "true" ? "false" : "true"); });
  });

  /* ---------- copy ---------- */
  $$(".copy").forEach(function (b) {
    b.addEventListener("click", function () {
      var text = b.getAttribute("data-copy");
      var done = function () { b.classList.add("done"); setTimeout(function () { b.classList.remove("done"); }, 1400); };
      var fallback = function () {
        var src = b.parentNode.querySelector("code");
        if (src) { var r = document.createRange(); r.selectNodeContents(src); var s = window.getSelection(); s.removeAllRanges(); s.addRange(r); }
      };
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, fallback);
        else fallback();
      } catch (e) { fallback(); }
    });
  });

  /* ---------- glossary filter (no motion: it runs on every keystroke) ---------- */
  var gf = $("#gloss-filter");
  if (gf) {
    var terms = $$(".glossary dt"), empty = $(".gempty"), sections = $$(".glossary h2");
    gf.addEventListener("input", function () {
      var v = gf.value.trim().toLowerCase(), any = false;
      terms.forEach(function (dt) {
        var dd = dt.nextElementSibling, hit = !v || (dt.textContent + " " + dd.textContent).toLowerCase().indexOf(v) > -1;
        dt.hidden = !hit; dd.hidden = !hit; if (hit) any = true;
      });
      sections.forEach(function (h) {
        var dl = h.nextElementSibling; var vis = dl && $$("dt", dl).some(function (d) { return !d.hidden; });
        h.hidden = !vis; if (dl) dl.hidden = !vis;
      });
      if (empty) empty.style.display = any ? "none" : "block";
    });
  }

  /* ---------- table of contents ---------- */
  var toc = $(".toc");
  if (toc && "IntersectionObserver" in window) {
    var links = $$("a", toc), map = {};
    links.forEach(function (a) { map[a.getAttribute("href").slice(1)] = a; });
    var io3 = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (e.isIntersecting && map[e.target.id]) { links.forEach(function (a) { a.classList.remove("on"); }); map[e.target.id].classList.add("on"); }
      });
    }, { rootMargin: "-20% 0px -70% 0px" });
    $$(".prose h2[id]").forEach(function (h) { io3.observe(h); });
  }
})();

/* ---------------- Trust Center: tabs, control nav, search */
(function () {
  var root = document.querySelector('.tc-body'); if (!root) return;
  var tabs = root.querySelectorAll('.tc-tabs [data-tab]'), panels = root.querySelectorAll('.tc-panel');
  function show(name) {
    tabs.forEach(function (t) { var on = t.dataset.tab === name; t.classList.toggle('on', on); t.setAttribute('aria-selected', on); });
    panels.forEach(function (p) { p.classList.toggle('on', p.dataset.panel === name); });
  }
  tabs.forEach(function (t) { t.addEventListener('click', function () { show(t.dataset.tab); }); });
  function goCtrl(key) {
    root.querySelectorAll('.tc-cnav').forEach(function (b) { b.classList.toggle('on', b.dataset.go === key); });
    var el = root.querySelector('.tc-ctrl[data-ctrl="' + key + '"]'); if (!el) return;
    el.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    root.querySelectorAll('.tc-ctrl').forEach(function (c) { c.classList.remove('hl'); });
    el.classList.add('hl'); setTimeout(function () { el.classList.remove('hl'); }, 1400);
  }
  root.querySelectorAll('[data-tab-go]').forEach(function (b) {
    b.addEventListener('click', function () { show(b.dataset.tabGo); if (b.dataset.go) setTimeout(function () { goCtrl(b.dataset.go); }, 60); else root.scrollIntoView({ block: 'start' }); });
  });
  root.querySelectorAll('.tc-cnav').forEach(function (b) { b.addEventListener('click', function () { goCtrl(b.dataset.go); }); });
  var input = root.querySelector('.tc-search input');
  input.addEventListener('input', function () {
    var q = input.value.trim().toLowerCase();
    var hit = { controls: 0, documents: 0, faq: 0 };
    root.querySelectorAll('.tc-ctrl').forEach(function (c) {
      var head = c.dataset.q.indexOf(q) > -1, any = false;
      c.querySelectorAll('li').forEach(function (li) { var m = !q || head || li.textContent.toLowerCase().indexOf(q) > -1; li.hidden = !m; any = any || m; });
      c.hidden = !(any || !q); if (!c.hidden) hit.controls++;
    });
    root.querySelector('.tc-ctrls').classList.toggle('none', q && !hit.controls);
    root.querySelectorAll('.tc-panel[data-panel="documents"] .tc-group').forEach(function (g) {
      var n = 0; g.querySelectorAll('.tc-doc').forEach(function (d) { var m = !q || d.textContent.toLowerCase().indexOf(q) > -1; d.hidden = !m; if (m) n++; });
      g.hidden = !n; hit.documents += n;
    });
    root.querySelectorAll('.tc-faq').forEach(function (f) { var m = !q || f.textContent.toLowerCase().indexOf(q) > -1; f.hidden = !m; if (m) hit.faq++; if (q && m) f.open = true; if (!q) f.open = false; });
    if (q) { var cur = root.querySelector('.tc-tabs .on').dataset.tab; if (cur === 'overview' || !hit[cur]) { show(hit.controls ? 'controls' : hit.faq ? 'faq' : hit.documents ? 'documents' : 'controls'); } }
  });
})();

/* ---------------- Agents: learning demo */
(function () {
  var ld = document.querySelector('.ld'); if (!ld) return;
  var list = ld.querySelector('.ld-list'), up = ld.querySelector('.ld-up'), down = ld.querySelector('.ld-down'), saved = ld.querySelector('.ld-saved'), count = ld.querySelector('.ld-n');
  var initial = list.innerHTML, W = {}, reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var STEP_UP = 1.3, STEP_DN = 0.5;
  function feats(li) { return [li.dataset.setting, li.dataset.role, li.dataset.city.split(',')[0]]; }
  function score(li) { return feats(li).reduce(function (s, f) { return s * (W[f] || 1); }, parseFloat(li.dataset.base)); }
  function pct(v) { var p = Math.round((v - 1) * 100); return (p > 0 ? '+' : '') + p + '%'; }
  function renderSignals() {
    var ks = Object.keys(W), hi = ks.filter(function (k) { return W[k] > 1; }).sort(function (a, b) { return W[b] - W[a]; }), lo = ks.filter(function (k) { return W[k] < 1; }).sort(function (a, b) { return W[a] - W[b]; });
    up.innerHTML = hi.length ? hi.map(function (k) { return '<div class="ld-sig"><span>' + k + '</span><b>' + pct(W[k]) + '</b></div>'; }).join('') : '<p class="ld-empty">Approve someone to see what it favors.</p>';
    down.innerHTML = lo.length ? lo.map(function (k) { return '<div class="ld-sig"><span>' + k + '</span><b>' + pct(W[k]) + '</b></div>'; }).join('') : '<p class="ld-empty">Pass on someone to see what it avoids.</p>';
  }
  function rerank() {
    var items = Array.prototype.slice.call(list.children);
    var first = items.map(function (el) { return el.getBoundingClientRect().top; });
    items.slice().sort(function (a, b) { return score(b) - score(a); }).forEach(function (el) { list.appendChild(el); });
    if (reduce) return;
    items.forEach(function (el, i) {
      var dy = first[i] - el.getBoundingClientRect().top; if (!dy) return;
      el.style.transition = 'none'; el.style.transform = 'translateY(' + dy + 'px)';
      requestAnimationFrame(function () { requestAnimationFrame(function () { el.style.transition = 'transform 420ms cubic-bezier(0.32, 0.72, 0, 1)'; el.style.transform = ''; }); });
    });
  }
  function decide(li, d) {
    feats(li).forEach(function (f) { W[f] = Math.max(0.2, Math.min(2.4, (W[f] || 1) * (d === 'ok' ? STEP_UP : STEP_DN))); });
    if (d === 'ok') {
      if (saved.querySelector('.ld-empty')) saved.innerHTML = '';
      saved.insertAdjacentHTML('beforeend', '<div class="ld-sv"><img src="' + li.querySelector('img').getAttribute('src') + '" alt="" width="26" height="26"><span>' + li.querySelector('b').textContent + '</span></div>');
    }
    li.classList.add('out');
    setTimeout(function () {
      li.remove(); renderSignals(); rerank();
      var n = list.children.length; count.textContent = n ? n + ' waiting' : 'All reviewed';
      ld.classList.toggle('finished', !n);
    }, reduce ? 0 : 220);
  }
  ld.addEventListener('click', function (e) {
    var b = e.target.closest('.ld-b'); if (b) { decide(b.closest('.ld-c'), b.dataset.d); return; }
    if (e.target.closest('.ld-reset')) { W = {}; list.innerHTML = initial; saved.innerHTML = '<p class="ld-empty">No one yet.</p>'; renderSignals(); count.textContent = '6 waiting'; ld.classList.remove('finished'); }
  });
})();

/* ---------------- Products dropdown */
(function () {
  var dd = document.querySelector('.dd'); if (!dd) return;
  var btn = dd.querySelector('.dd__btn'), t;
  function set(open) { dd.classList.toggle('open', open); btn.setAttribute('aria-expanded', open); }
  var fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  if (fine) {
    dd.addEventListener('mouseenter', function () { clearTimeout(t); set(true); });
    dd.addEventListener('mouseleave', function () { t = setTimeout(function () { set(false); }, 120); });
  }
  btn.addEventListener('click', function () { set(!dd.classList.contains('open')); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && dd.classList.contains('open')) { set(false); btn.focus(); } });
  document.addEventListener('click', function (e) { if (!dd.contains(e.target)) set(false); });
  dd.addEventListener('focusout', function (e) { if (!dd.contains(e.relatedTarget)) set(false); });
})();

/* ---------------- How Oslr reads a search */
(function () {
  var rd = document.querySelector('.rd'); if (!rd) return;
  var ts = rd.querySelectorAll('.rd-t'), cs = rd.querySelectorAll('.rd-c'), auto = true, i = 0, timer;
  function show(n) { i = n; ts.forEach(function (t) { t.classList.toggle('on', +t.dataset.i === n); }); cs.forEach(function (c) { c.classList.toggle('on', +c.dataset.i === n); }); }
  ts.forEach(function (t) { t.addEventListener('click', function () { auto = false; clearInterval(timer); show(+t.dataset.i); }); });
  if (!matchMedia('(prefers-reduced-motion: reduce)').matches && 'IntersectionObserver' in window) {
    new IntersectionObserver(function (es) { es.forEach(function (e) {
      clearInterval(timer); if (e.isIntersecting && auto) timer = setInterval(function () { show((i + 1) % ts.length); }, 2600);
    }); }, { threshold: 0.5 }).observe(rd);
  }
})();
