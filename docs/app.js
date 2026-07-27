// ============================================================
// 刷题逻辑 (纯前端，无后端)
// ============================================================
(function () {
  "use strict";

  var STORAGE_KEY = "ej_quiz_state_v1";
  var BATCH = 10; // 每组题量（全部/随机模式使用；章节模式一次性给整章）

  // ---- 题库扁平化 ----
  var ALL = [];
  (window.QUESTIONS.chapters || []).forEach(function (ch) {
    (ch.questions || []).forEach(function (q) {
      q._chapterName = ch.name;
      q._chapterId = ch.id;
      ALL.push(q);
    });
  });
  var BY_ID = {};
  ALL.forEach(function (q) { BY_ID[q.id] = q; });

  // ---- 状态 ----
  function loadState() {
    try {
      var s = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (s && typeof s === "object") {
        if (!s.wrongCount || typeof s.wrongCount !== "object") s.wrongCount = {};
        if (!Array.isArray(s.done)) s.done = [];
        if (!Array.isArray(s.wrong)) s.wrong = [];
        return s;
      }
    } catch (e) {}
    return { done: [], wrong: [], correctCount: 0, totalAnswered: 0, lastSeq: 0, wrongCount: {} };
  }
  function saveState(s) { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); }
  var state = loadState();

  // ---- DOM ----
  var $ = function (id) { return document.getElementById(id); };
  var homeView = $("homeView"), quizView = $("quizView"), endView = $("endView"), chapterView = $("chapterView"), simView = $("simView"), examResultView = $("examResultView");

  // ---- 视图切换 ----
  function show(view) {
    [homeView, quizView, endView, chapterView, simView, examResultView].forEach(function (v) { v.classList.add("hidden"); });
    view.classList.remove("hidden");
    window.scrollTo(0, 0);
  }

  // ---- 首页统计 ----
  function totalWrongCount() {
    var t = 0;
    for (var k in state.wrongCount) {
      if (state.wrongCount.hasOwnProperty(k)) t += state.wrongCount[k];
    }
    return t;
  }
  function refreshHome() {
    $("statDone").textContent = state.done.length;
    $("statWrong").textContent = state.wrong.length;
    $("statWrongCount").textContent = totalWrongCount();
    $("statRate").textContent = state.totalAnswered
      ? Math.round((state.correctCount / state.totalAnswered) * 100) + "%"
      : "--";
    var wh = $("wrongHint");
    wh.textContent = state.wrong.length ? ("重做 " + state.wrong.length + " 道错题") : "暂无错题";
    renderWeakList();
  }

  // ---- 薄弱环节排行（首页底部）：按累计错次降序，点击直接进薄弱专攻 ----
  function renderWeakList() {
    var sec = $("weakSection");
    var box = $("weakList");
    if (!sec || !box) return;
    var items = [];
    ALL.forEach(function (q) {
      var n = state.wrongCount[q.id] || 0;
      if (n > 0) items.push({ q: q, n: n });
    });
    items.sort(function (a, b) { return b.n - a.n; });
    items = items.slice(0, 8);
    if (!items.length) { sec.classList.add("hidden"); return; }
    sec.classList.remove("hidden");
    box.innerHTML = "";
    items.forEach(function (it) {
      var el = document.createElement("button");
      el.className = "weak-item";
      var chName = it.q._chapterName || it.q.chapter || "";
      var chTag = chapterTitle(chName);
      el.innerHTML =
        '<span class="wk-chapter">' + escapeHtml(chTag) + "</span>" +
        '<span class="wk-stem">' + escapeHtml(it.q.stem) + "</span>" +
        '<span class="wk-count">错 ' + it.n + " 次</span>";
      el.addEventListener("click", function () {
        startQuiz("weak", null, { startId: it.q.id });
      });
      box.appendChild(el);
    });
  }

  // ---- 构建一组题目 ----
  function buildBatch(mode, chapterId, opts) {
    var pool;
    if (mode === "wrong") {
      pool = state.wrong.map(function (id) { return BY_ID[id]; }).filter(Boolean);
      if (!pool.length) { alert("错题本还是空的，先去刷几道题吧～"); return null; }
    } else if (mode === "weak") {
      // 薄弱专攻：只看曾经做错过（累计错次>0）的题，按错次从高到低排序，缩小复习范围
      pool = [];
      ALL.forEach(function (q) { if ((state.wrongCount[q.id] || 0) > 0) pool.push(q); });
      pool.sort(function (a, b) { return (state.wrongCount[b.id] || 0) - (state.wrongCount[a.id] || 0); });
      if (!pool.length) { alert("还没有错题记录，先去刷几道题吧～"); return null; }
      if (opts && opts.startId) {
        var si = -1;
        for (var k = 0; k < pool.length; k++) { if (pool[k].id === opts.startId) { si = k; break; } }
        if (si > 0) { var head = pool.splice(si, 1); pool = head.concat(pool); }
      }
    } else if (mode === "random") {
      pool = shuffle(ALL.slice());
    } else { // sequence
      var base = chapterId
        ? ALL.filter(function (q) { return q._chapterId === chapterId; })
        : ALL;
      if (freqFilter) base = base.filter(function (q) { return freqOf(q) === freqFilter; });
      if (!base.length) return null;
      if (chapterId) {
        // 章节顺序刷：一次性给出该章全部题目，保证 1~N 题都能刷到
        // （修复此前“start 恒为 0 且不在章节模式更新进度”导致只刷到前 5 题的 bug）
        pool = base.slice();
      } else {
        // 全部章节顺序刷：按 BATCH 分组、跨章续接进度
        var start = state.lastSeq % base.length;
        pool = [];
        for (var i = 0; i < base.length && pool.length < BATCH; i++) {
          pool.push(base[(start + i) % base.length]);
        }
        state.lastSeq = (start + pool.length) % base.length;
        saveState(state);
      }
    }
    if (mode === "random") pool = pool.slice(0, BATCH);
    return pool;
  }

  // ---- 章节选择（顺序刷题入口）：方法示范置顶，经济基础按第X章严格数字排序，人力方向置底 ----
  var freqFilter = null; // null=全部；"高"/"中"/"低"

  function chapterTitle(name) {
    var m = String(name).match(/第[^章]*章.*/);
    return m ? m[0].trim() : name;
  }
  function chapterOrder(ch) {
    if (ch.id === "demo") return 0;             // 方法示范置顶
    var m = String(ch.name).match(/第(\d+)章/);
    if (m) return parseInt(m[1], 10);           // 经济基础按章号
    return 1000;                               // 人力方向置底
  }
  function chapterGroup(ch) {
    if (ch.id === "demo") return "方法示范";
    if (/第\d+章/.test(ch.name) || /^e\d/.test(ch.id)) return "经济基础";
    return "人力方向";
  }
  function freqOf(q) {
    if (q.freq) return q.freq;
    if (q._chapterId === "demo") return "示范";
    return "中"; // 示例/人力占位，待替换真实资料后标注
  }
  function renderFreqFilter() {
    var bar = $("freqFilter");
    if (!bar) return;
    var opts = [["全部", null], ["高频", "高"], ["中频", "中"], ["低频", "低"]];
    bar.innerHTML = "";
    opts.forEach(function (o) {
      var b = document.createElement("button");
      b.className = "freq-btn" + (freqFilter === o[1] ? " active" : "");
      b.textContent = o[0];
      b.addEventListener("click", function () { freqFilter = o[1]; openChapters(); });
      bar.appendChild(b);
    });
  }
  function openChapters() {
    renderFreqFilter();
    var list = $("chapterList");
    list.innerHTML = "";
    list.appendChild(chapterRow(null)); // 全部章节
    var chs = (window.QUESTIONS.chapters || []).slice();
    chs.sort(function (a, b) { return chapterOrder(a) - chapterOrder(b); });
    var lastGroup = null;
    chs.forEach(function (ch) {
      var g = chapterGroup(ch);
      if (g !== lastGroup) {
        var h = document.createElement("div");
        h.className = "group-header";
        h.textContent = g;
        list.appendChild(h);
        lastGroup = g;
      }
      list.appendChild(chapterRow(ch));
    });
    show(chapterView);
  }
  function chapterRow(ch) {
    var el = document.createElement("button");
    el.className = "chapter-item";
    var isAll = !ch;
    var title = isAll ? "全部章节（从头顺序刷）" : chapterTitle(ch.name);
    var base = isAll ? ALL.slice() : ALL.filter(function (q) { return q._chapterId === ch.id; });
    if (freqFilter) base = base.filter(function (q) { return freqOf(q) === freqFilter; });
    var total = base.length;
    var done = 0;
    base.forEach(function (q) { if (state.done.indexOf(q.id) >= 0) done++; });
    var dist = { "高": 0, "中": 0, "低": 0 };
    base.forEach(function (q) { var f = freqOf(q); if (dist[f] != null) dist[f]++; });
    el.innerHTML =
      '<span class="ch-title">' + escapeHtml(title) + "</span>" +
      '<span class="ch-info"><span class="ch-freq">高' + dist["高"] + ' 中' + dist["中"] + ' 低' + dist["低"] + '</span>' +
      '<span class="ch-meta">' + done + " / " + total + " 题</span></span>";
    el.addEventListener("click", function () {
      startQuiz(isAll ? "sequence" : "sequence", isAll ? null : ch.id);
    });
    return el;
  }

  // ---- 仿真练习：按章 → 知识点分组，每组5题（适配零碎时间） ----
  function simChapterGroups(chapterId) {
    var base = ALL.filter(function (q) { return q._chapterId === chapterId; });
    var groups = [];
    for (var i = 0; i < base.length; i += 5) groups.push(base.slice(i, i + 5));
    return groups;
  }
  function openSim() {
    var list = $("simChapterList");
    list.innerHTML = "";
    var chs = (window.QUESTIONS.chapters || []).slice();
    chs.sort(function (a, b) { return chapterOrder(a) - chapterOrder(b); });
    var lastGroup = null;
    chs.forEach(function (ch) {
      var qs = ch.questions || [];
      if (!qs.length) return;
      var g = chapterGroup(ch);
      if (g !== lastGroup) {
        var h = document.createElement("div");
        h.className = "group-header";
        h.textContent = g;
        list.appendChild(h);
        lastGroup = g;
      }
      var total = qs.length;
      var groups = Math.ceil(total / 5);
      var done = 0;
      qs.forEach(function (q) { if (state.done.indexOf(q.id) >= 0) done++; });
      var el = document.createElement("button");
      el.className = "chapter-item";
      el.innerHTML =
        '<span class="ch-title">' + escapeHtml(chapterTitle(ch.name)) + "</span>" +
        '<span class="ch-info"><span class="ch-freq">共 ' + total + " 题 · " + groups + ' 组</span>' +
        '<span class="ch-meta">' + done + " / " + total + " 已练</span></span>";
      el.addEventListener("click", function () { openSimPoints(ch.id); });
      list.appendChild(el);
    });
    $("simTitle").textContent = "仿真练习 · 选章节";
    $("simChapterList").classList.remove("hidden");
    $("simPointList").classList.add("hidden");
    show(simView);
  }
  function openSimPoints(chapterId) {
    var ch = (window.QUESTIONS.chapters || []).filter(function (c) { return c.id === chapterId; })[0];
    var chapterName = ch ? ch.name : "";
    var groups = simChapterGroups(chapterId);
    var list = $("simPointList");
    list.innerHTML = "";
    groups.forEach(function (grp, gi) {
      var pts = [];
      grp.forEach(function (q) { var p = (q.point || "综合").trim(); if (pts.indexOf(p) < 0) pts.push(p); });
      var ptsTxt = pts.join(" · ");
      if (ptsTxt.length > 30) ptsTxt = ptsTxt.slice(0, 30) + "…";
      var done = 0;
      grp.forEach(function (q) { if (state.done.indexOf(q.id) >= 0) done++; });
      var el = document.createElement("button");
      el.className = "chapter-item";
      el.innerHTML =
        '<span class="ch-title">第 ' + (gi + 1) + " 组 · " + grp.length + ' 题</span>' +
        '<span class="ch-info"><span class="ch-freq">' + escapeHtml(ptsTxt) + "</span>" +
        '<span class="ch-meta">' + done + " / " + grp.length + " 已练</span></span>";
      el.addEventListener("click", function () { startSimGroup(chapterId, chapterName, gi); });
      list.appendChild(el);
    });
    $("simTitle").textContent = "仿真练习 · " + (chapterTitle(chapterName) || chapterName);
    $("simChapterList").classList.add("hidden");
    $("simPointList").classList.remove("hidden");
    show(simView);
  }
  function startSimGroup(chapterId, chapterName, groupIndex) {
    var base = ALL.filter(function (q) { return q._chapterId === chapterId; });
    var totalGroups = Math.ceil(base.length / 5);
    var group = base.slice(groupIndex * 5, groupIndex * 5 + 5);
    if (!group.length) { openSimPoints(chapterId); return; }
    group = shuffle(group.slice()); // 仿真测效果：打乱顺序防肌肉记忆
    session = {
      queue: group, idx: 0, correct: 0, mode: "sim",
      chapterId: chapterId, chapterTitle: chapterTitle(chapterName), chapterName: chapterName,
      groupIndex: groupIndex, totalGroups: totalGroups, chapterTotal: base.length
    };
    show(quizView);
    renderQuestion();
  }

  function shuffle(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }

  // ---- 真实多选题判分：错选0分；未错选时全对2分、少选每对0.5分 ----
  function sameSet(a, b) {
    return a.slice().sort(function (x, y) { return x - y; }).join(",") ===
           b.slice().sort(function (x, y) { return x - y; }).join(",");
  }
  function scoreMulti(picked, answer) {
    var ans = answer.slice().sort(function (x, y) { return x - y; });
    var sel = picked.slice().sort(function (x, y) { return x - y; });
    for (var i = 0; i < sel.length; i++) {
      if (ans.indexOf(sel[i]) < 0) return 0; // 错选（含任一错误项）→ 0分
    }
    var correctSel = 0;
    for (var j = 0; j < ans.length; j++) { if (sel.indexOf(ans[j]) >= 0) correctSel++; }
    if (correctSel === ans.length) return 2; // 全对 → 满分2分
    return correctSel * 0.5;               // 少选 → 每对一个0.5分
  }

  // ---- 练习会话 ----
  var session = null; // { queue:[], idx:0, correct:0, mode }
  var current = null;
  var selected = []; // 已选下标

  function startQuiz(mode, chapterId, opts) {
    var batch = buildBatch(mode, chapterId, opts);
    if (!batch) return;
    var chTitle = null;
    if (chapterId) {
      var ch = (window.QUESTIONS.chapters || []).filter(function (c) { return c.id === chapterId; })[0];
      chTitle = ch ? chapterTitle(ch.name) : null;
    }
    session = { queue: batch, idx: 0, correct: 0, mode: mode, chapterId: chapterId || null, chapterTitle: chTitle, opts: opts || null };
    show(quizView);
    renderQuestion();
  }

  function renderQuestion() {
    current = session.queue[session.idx];
    selected = [];
    $("quizProgressText").textContent =
      "第 " + (session.idx + 1) + " / " + session.queue.length + " 题";
    $("qChapter").textContent = current._chapterName || current.chapter || "";
    $("qType").textContent = current.multi ? "多选题" : "单选题";
    var fEl = $("qFreq");
    if (fEl) {
      var f = freqOf(current);
      fEl.textContent = f === "示范" ? "方法" : (f === "高" ? "高频" : f === "中" ? "中频" : "低频");
      fEl.className = "q-freq freq-" + (f === "高" ? "high" : f === "中" ? "mid" : f === "低" ? "low" : "demo");
    }

    // 本次题目累计错次提示（仅在该题曾被做错时显示）
    var wcEl = $("qWrongCount");
    var wc = state.wrongCount[current.id] || 0;
    if (wc > 0) {
      wcEl.textContent = "已错 " + wc + " 次";
      wcEl.classList.remove("hidden");
    } else {
      wcEl.classList.add("hidden");
    }

    var stem = $("qStem");
    stem.textContent = current.stem;

    var box = $("qOptions");
    box.innerHTML = "";
    var letters = ["A", "B", "C", "D", "E", "F"];
    current.options.forEach(function (opt, i) {
      var el = document.createElement("div");
      el.className = "option";
      el.dataset.idx = i;
      el.innerHTML = '<span class="tag">' + letters[i] + "</span><span>" + escapeHtml(opt) + "</span>";
      el.addEventListener("click", function () { onSelect(i, el); });
      box.appendChild(el);
    });

    var analysis = $("qAnalysis");
    analysis.classList.add("hidden");
    analysis.innerHTML = "";

    $("submitBtn").disabled = true;
    $("submitBtn").classList.remove("hidden");
    $("nextBtn").classList.add("hidden");
    $("nextBtn").textContent = (session.idx + 1 < session.queue.length)
      ? "下一题 →"
      : (session.mode === "exam" ? "交卷 ✓" : "完成");
  }

  function onSelect(i, el) {
    if (el.classList.contains("locked")) return;
    if (current.multi) {
      var pos = selected.indexOf(i);
      if (pos >= 0) { selected.splice(pos, 1); el.classList.remove("selected"); }
      else { selected.push(i); el.classList.add("selected"); }
    } else {
      selected = [i];
      document.querySelectorAll("#qOptions .option").forEach(function (o) { o.classList.remove("selected"); });
      el.classList.add("selected");
    }
    $("submitBtn").disabled = selected.length === 0;
  }

  function submit() {
    if (!selected.length) return;
    var correctSet = current.answer.slice().sort().join(",");
    var picked = selected.slice().sort().join(",");
    var isRight = correctSet === picked;

    // 标记选项
    var opts = document.querySelectorAll("#qOptions .option");
    opts.forEach(function (o, i) {
      o.classList.add("locked");
      if (current.answer.indexOf(i) >= 0) o.classList.add("correct");
      else if (selected.indexOf(i) >= 0) o.classList.add("wrong");
    });

    // 解析
    var letters = ["A", "B", "C", "D", "E", "F"];
    var ansTxt = current.answer.map(function (i) { return letters[i]; }).join("、");
    var a = $("qAnalysis");
    var html = "<b>正确答案：" + ansTxt + "</b>";
    if (current.point) {
      html += '<div class="point-card"><span class="cs-label" style="background:var(--brand-soft);color:var(--brand)">知识点</span>' + escapeHtml(current.point) + "</div>";
    }
    if (current.correct) {
      html += '<div class="correct-statement"><span class="cs-label">正确表述 · 对比记忆</span>' + escapeHtml(current.correct) + "</div>";
    }
    html += '<div class="analysis-body">' + escapeHtml(current.analysis || "（暂无解析）") + "</div>";
    a.innerHTML = html;
    a.classList.remove("hidden");

    // 记录（考试模式：仅计分，不污染练习进度）
    if (session.mode === "exam") {
      session.results.push({ q: current, picked: selected.slice() });
    } else {
      if (state.done.indexOf(current.id) < 0) state.done.push(current.id);
      if (isRight) {
        state.correctCount++;
        // 答对则从错题本移除
        var wi = state.wrong.indexOf(current.id);
        if (wi >= 0) state.wrong.splice(wi, 1);
      } else {
        if (state.wrong.indexOf(current.id) < 0) state.wrong.push(current.id);
        // 累计错次：每错一次 +1，用于薄弱专攻排序与复习范围聚焦
        state.wrongCount[current.id] = (state.wrongCount[current.id] || 0) + 1;
      }
      state.totalAnswered++;
      saveState(state);
    }

    if (isRight) session.correct++;
    $("submitBtn").classList.add("hidden");
    $("nextBtn").classList.remove("hidden");
  }

  function next() {
    if (session.idx + 1 < session.queue.length) {
      session.idx++;
      renderQuestion();
    } else {
      if (session.mode === "exam") finishExam(false);
      else endSession();
    }
  }

  function endSession() {
    show(endView);
    if (session.mode === "sim") {
      $("endTitle").textContent = "本组完成 · 第 " + (session.groupIndex + 1) + " 组";
      var base = ALL.filter(function (q) { return q._chapterId === session.chapterId; });
      var done = 0;
      base.forEach(function (q) { if (state.done.indexOf(q.id) >= 0) done++; });
      $("endSummary").textContent =
        "本组 " + session.queue.length + " 题，答对 " + session.correct + " 题。" +
        "本章累计已练 " + done + " / " + session.chapterTotal + " 题。";
      $("againBtn").textContent = (session.groupIndex + 1 < session.totalGroups) ? "下一组 ▶" : "重头再来";
      $("againBtn").classList.remove("hidden");
      $("simReplayBtn").classList.remove("hidden");
      refreshHome();
      return;
    }
    $("endTitle").textContent = session.mode === "wrong"
      ? "错题重做完成"
      : (session.mode === "weak"
        ? "薄弱专攻完成"
        : (session.chapterTitle ? ("「" + session.chapterTitle + "」练习完成") : "本组完成"));
    $("endSummary").textContent =
      "本次 " + session.queue.length + " 题，答对 " + session.correct + " 题。累计已做 " +
      state.done.length + " 题，错题 " + state.wrong.length + " 道，累计错次 " + totalWrongCount() + "。";
    $("againBtn").textContent = "再来一组";
    $("againBtn").classList.remove("hidden");
    $("simReplayBtn").classList.add("hidden");
    refreshHome();
  }

  // ---- 整套模拟卷：70单 + 35多、90分钟、机考式、真实判分 ----
  var EXAM_MIN = 90, EXAM_SINGLE = 70, EXAM_MULTI = 35, EXAM_PASS = 84;
  var examTimer = null, examDeadline = 0;

  function startExam() {
    var singles = shuffle(ALL.filter(function (q) { return !q.multi; }));
    var multis = shuffle(ALL.filter(function (q) { return q.multi; }));
    if (singles.length < EXAM_SINGLE || multis.length < EXAM_MULTI) {
      alert("题库题量不足，暂无法组卷（需 ≥70 单选、≥35 多选）。");
      return;
    }
    var picks = singles.slice(0, EXAM_SINGLE).concat(multis.slice(0, EXAM_MULTI));
    picks = shuffle(picks);
    session = {
      queue: picks, idx: 0, correct: 0, mode: "exam",
      results: [], chapterId: null, chapterTitle: null, opts: null
    };
    $("quizTimer").classList.remove("hidden");
    show(quizView);
    renderQuestion();
    startExamTimer();
  }
  function startExamTimer() {
    stopExamTimer();
    examDeadline = Date.now() + EXAM_MIN * 60 * 1000;
    tickExamTimer();
    examTimer = setInterval(tickExamTimer, 1000);
  }
  function stopExamTimer() { if (examTimer) { clearInterval(examTimer); examTimer = null; } }
  function tickExamTimer() {
    var left = Math.max(0, examDeadline - Date.now());
    var total = Math.floor(left / 1000);
    var mm = String(Math.floor(total / 60)).padStart(2, "0");
    var ss = String(total % 60).padStart(2, "0");
    var el = $("quizTimer");
    if (el) {
      el.textContent = "⏱ " + mm + ":" + ss;
      el.classList.toggle("urgent", total <= 300); // 最后5分钟高亮
    }
    if (left <= 0) { stopExamTimer(); finishExam(true); }
  }
  function finishExam(timeUp) {
    stopExamTimer();
    var total = 0, singleRight = 0, multiFull = 0, multiPart = 0;
    session.results.forEach(function (r) {
      if (!r.q.multi) {
        if (sameSet(r.q.answer, r.picked)) { total += 1; singleRight++; }
      } else {
        var s = scoreMulti(r.picked, r.q.answer);
        total += s;
        if (s >= 2) multiFull++; else if (s > 0) multiPart++;
      }
    });
    total = Math.round(total * 10) / 10;
    renderExamResult({
      total: total, pass: total >= EXAM_PASS, timeUp: !!timeUp,
      singleRight: singleRight, singleTotal: EXAM_SINGLE,
      multiFull: multiFull, multiPart: multiPart, multiTotal: EXAM_MULTI,
      results: session.results
    });
  }
  function renderExamResult(r) {
    show(examResultView);
    $("quizTimer").classList.add("hidden");
    $("examScore").textContent = r.total;
    var pass = $("examPass");
    pass.textContent = r.pass ? "🎉 合格（≥84 分）" : "未合格（需 ≥84 分）";
    pass.className = "exam-pass " + (r.pass ? "ok" : "no");
    $("examSummary").textContent =
      "单选答对 " + r.singleRight + " / " + r.singleTotal +
      "；多选满分 " + r.multiFull + " 题、部分得分 " + r.multiPart + " 题。" +
      (r.timeUp ? "（时间到，自动交卷）" : "");
    var box = $("examReview");
    box.innerHTML = "";
    var letters = ["A", "B", "C", "D", "E", "F"];
    r.results.forEach(function (it, i) {
      var q = it.q;
      var picked = it.picked.slice().sort(function (a, b) { return a - b; });
      var ans = q.answer.slice().sort(function (a, b) { return a - b; });
      var earned = q.multi ? scoreMulti(picked, ans) : (sameSet(ans, picked) ? 1 : 0);
      var fullyRight = q.multi ? (earned >= 2) : (earned >= 1);
      var pickedTxt = picked.length ? picked.map(function (x) { return letters[x]; }).join("、") : "（未作答）";
      var ansTxt = ans.map(function (x) { return letters[x]; }).join("、");
      var el = document.createElement("div");
      el.className = "rev-item " + (fullyRight ? "r-correct" : (earned > 0 ? "r-part" : "r-wrong"));
      var html =
        '<div class="rev-head"><span class="rev-no">第 ' + (i + 1) + ' 题</span>' +
        '<span class="rev-pts">' + (q.multi ? ("多选 · 得 " + earned + " 分") : ("单选 · 得 " + earned + " 分")) + '</span></div>' +
        '<div class="rev-stem">' + escapeHtml(q.stem) + '</div>' +
        '<div class="rev-ans">你的答案：<b>' + escapeHtml(pickedTxt) + '</b> ｜ 正确答案：<b>' + escapeHtml(ansTxt) + '</b></div>';
      html += '<div class="rev-opts">';
      q.options.forEach(function (opt, oi) {
        var cls = "rev-opt";
        if (ans.indexOf(oi) >= 0) cls += " is-correct";
        else if (picked.indexOf(oi) >= 0) cls += " is-wrong";
        html += '<div class="' + cls + '">' + letters[oi] + ". " + escapeHtml(opt) + '</div>';
      });
      html += '</div>';
      if (q.point) html += '<div class="rev-point">知识点：' + escapeHtml(q.point) + '</div>';
      if (q.analysis) html += '<div class="rev-analysis">解析：' + escapeHtml(q.analysis) + '</div>';
      el.innerHTML = html;
      box.appendChild(el);
    });
  }

  // ---- 工具 ----
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  // ---- 事件绑定 ----
  document.querySelectorAll(".mode-btn").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var m = btn.dataset.mode;
      if (m === "sequence") openChapters();
      else if (m === "sim") openSim();
      else if (m === "exam") $("examIntro").classList.remove("hidden");
      else startQuiz(m);
    });
  });
  $("submitBtn").addEventListener("click", submit);
  $("nextBtn").addEventListener("click", next);
  $("quitBtn").addEventListener("click", function () {
    if (session && session.mode === "exam") {
      if (window.confirm("退出模拟卷？已作答部分将按真实判分计入成绩。")) finishExam(false);
      return;
    }
    if (session && session.mode === "sim") openSimPoints(session.chapterId);
    else if (session && session.chapterId) openChapters();
    else { refreshHome(); show(homeView); }
  });
  $("chapterBackBtn").addEventListener("click", function () { refreshHome(); show(homeView); });
  $("againBtn").addEventListener("click", function () {
    if (session && session.mode === "sim") {
      var ni = (session.groupIndex + 1) % session.totalGroups;
      startSimGroup(session.chapterId, session.chapterName, ni);
    } else {
      startQuiz(session.mode, session.chapterId, session.opts);
    }
  });
  $("simReplayBtn").addEventListener("click", function () {
    if (session && session.mode === "sim") startSimGroup(session.chapterId, session.chapterName, session.groupIndex);
  });
  $("simBackBtn").addEventListener("click", function () { refreshHome(); show(homeView); });
  $("backHomeBtn").addEventListener("click", function () { refreshHome(); show(homeView); });

  // 整套模拟卷
  $("examStartBtn").addEventListener("click", function () { $("examIntro").classList.add("hidden"); startExam(); });
  $("examCancelBtn").addEventListener("click", function () { $("examIntro").classList.add("hidden"); });
  $("examHomeBtn").addEventListener("click", function () { stopExamTimer(); refreshHome(); show(homeView); });

  // ---- 同步进度（导出/导入，多设备） ----
  var SYNC_PREFIX = "EJQ1."; // 同步码格式版本前缀

  function encodeState() {
    var payload = {
      v: 1,
      t: Date.now(),
      done: state.done,
      wrong: state.wrong,
      correctCount: state.correctCount,
      totalAnswered: state.totalAnswered,
      lastSeq: state.lastSeq,
      wrongCount: state.wrongCount
    };
    // JSON → UTF-8 安全 base64
    var json = JSON.stringify(payload);
    return SYNC_PREFIX + btoa(unescape(encodeURIComponent(json)));
  }

  function decodeSync(text) {
    text = (text || "").trim();
    // 允许直接粘贴 JSON（下载文件的内容）
    if (text.charAt(0) === "{") {
      try { return normalizePayload(JSON.parse(text)); } catch (e) { return null; }
    }
    if (text.indexOf(SYNC_PREFIX) !== 0) return null;
    try {
      var json = decodeURIComponent(escape(atob(text.slice(SYNC_PREFIX.length))));
      return normalizePayload(JSON.parse(json));
    } catch (e) { return null; }
  }

  function normalizePayload(p) {
    if (!p || typeof p !== "object") return null;
    if (!Array.isArray(p.done) || !Array.isArray(p.wrong)) return null;
    if (!p.wrongCount || typeof p.wrongCount !== "object") p.wrongCount = {};
    p.correctCount = +p.correctCount || 0;
    p.totalAnswered = +p.totalAnswered || 0;
    p.lastSeq = +p.lastSeq || 0;
    // 只保留题库中存在的题目 ID，避免脏数据
    p.done = p.done.filter(function (id) { return BY_ID[id]; });
    p.wrong = p.wrong.filter(function (id) { return BY_ID[id]; });
    var wc = {};
    for (var k in p.wrongCount) {
      if (p.wrongCount.hasOwnProperty(k) && BY_ID[k]) {
        var n = +p.wrongCount[k];
        if (n > 0) wc[k] = n;
      }
    }
    p.wrongCount = wc;
    return p;
  }

  function mergeInto(p) {
    // 并集合并：done/wrong 取并集；wrongCount 每题取较大值；计数取较大值
    p.done.forEach(function (id) { if (state.done.indexOf(id) < 0) state.done.push(id); });
    p.wrong.forEach(function (id) { if (state.wrong.indexOf(id) < 0) state.wrong.push(id); });
    for (var k in p.wrongCount) {
      if (p.wrongCount.hasOwnProperty(k)) {
        state.wrongCount[k] = Math.max(state.wrongCount[k] || 0, p.wrongCount[k]);
      }
    }
    state.correctCount = Math.max(state.correctCount, p.correctCount);
    state.totalAnswered = Math.max(state.totalAnswered, p.totalAnswered);
    state.lastSeq = Math.max(state.lastSeq, p.lastSeq);
  }

  function overwriteWith(p) {
    state = {
      done: p.done, wrong: p.wrong,
      correctCount: p.correctCount, totalAnswered: p.totalAnswered,
      lastSeq: p.lastSeq, wrongCount: p.wrongCount
    };
  }

  function syncMsg(text, ok) {
    var el = $("syncMsg");
    el.textContent = text;
    el.classList.remove("hidden");
    el.className = "sync-msg " + (ok ? "sync-ok" : "sync-err");
  }

  function doImport(mode) {
    var p = decodeSync($("syncImportText").value);
    if (!p) { syncMsg("同步码无效或已损坏，请检查后重试。", false); return; }
    if (mode === "merge") mergeInto(p); else overwriteWith(p);
    saveState(state);
    refreshHome();
    var when = p.t ? new Date(p.t).toLocaleString() : "未知时间";
    syncMsg((mode === "merge" ? "已合并导入" : "已覆盖导入") + "：已做 " + state.done.length + " 题、错题 " + state.wrong.length + " 道（对方导出于 " + when + "）。", true);
  }

  $("syncBtn").addEventListener("click", function () {
    $("syncExportText").value = "";
    $("syncImportText").value = "";
    $("syncMsg").classList.add("hidden");
    $("syncMask").classList.remove("hidden");
  });
  $("syncCloseBtn").addEventListener("click", function () { $("syncMask").classList.add("hidden"); });
  $("syncGenBtn").addEventListener("click", function () {
    $("syncExportText").value = encodeState();
    syncMsg("同步码已生成：已做 " + state.done.length + " 题、错题 " + state.wrong.length + " 道。复制或下载后到新设备导入。", true);
  });
  $("syncCopyBtn").addEventListener("click", function () {
    var ta = $("syncExportText");
    if (!ta.value) ta.value = encodeState();
    ta.select();
    ta.setSelectionRange(0, ta.value.length);
    var copied = false;
    try { copied = document.execCommand("copy"); } catch (e) {}
    if (!copied && navigator.clipboard) {
      navigator.clipboard.writeText(ta.value).then(function () { syncMsg("已复制到剪贴板。", true); });
      return;
    }
    syncMsg(copied ? "已复制到剪贴板。" : "复制失败，请长按/全选手动复制。", copied);
  });
  $("syncDownloadBtn").addEventListener("click", function () {
    var payload = {
      v: 1, t: Date.now(),
      done: state.done, wrong: state.wrong,
      correctCount: state.correctCount, totalAnswered: state.totalAnswered,
      lastSeq: state.lastSeq, wrongCount: state.wrongCount
    };
    var blob = new Blob([JSON.stringify(payload)], { type: "application/json" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    var d = new Date();
    a.download = "刷题进度-" + d.getFullYear() + ("0" + (d.getMonth() + 1)).slice(-2) + ("0" + d.getDate()).slice(-2) + ".json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
    syncMsg("进度文件已下载，到新设备用「选择文件」导入。", true);
  });
  $("syncFileInput").addEventListener("change", function () {
    var f = this.files && this.files[0];
    if (!f) return;
    var reader = new FileReader();
    reader.onload = function () {
      $("syncImportText").value = String(reader.result || "");
      syncMsg("文件已读入，点「合并导入」或「覆盖导入」完成同步。", true);
    };
    reader.readAsText(f);
    this.value = "";
  });
  $("syncMergeBtn").addEventListener("click", function () { doImport("merge"); });
  $("syncOverwriteBtn").addEventListener("click", function () { doImport("overwrite"); });

  // 重置
  $("resetBtn").addEventListener("click", function () { $("confirmMask").classList.remove("hidden"); });
  $("confirmNo").addEventListener("click", function () { $("confirmMask").classList.add("hidden"); });
  $("confirmYes").addEventListener("click", function () {
    state = { done: [], wrong: [], correctCount: 0, totalAnswered: 0, lastSeq: 0, wrongCount: {} };
    saveState(state);
    $("confirmMask").classList.add("hidden");
    refreshHome();
  });

  // ---- 初始化 ----
  refreshHome();
  show(homeView);
})();
