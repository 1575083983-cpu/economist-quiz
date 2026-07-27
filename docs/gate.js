// ============================================================
// 授权闸门 + 管理面板 (纯前端，无后端)
// 说明：静态站点无法做服务端鉴权，以下为前端闸门。
// 密码/授权码均以哈希存储，但代码可见，仅防随意进入/误改。
// ============================================================
(function () {
  "use strict";

  function hash(str) {
    var h = 5381;
    str = String(str);
    for (var i = 0; i < str.length; i++) {
      h = ((h << 5) + h + str.charCodeAt(i)) & 0xFFFFFFFF;
    }
    return (h >>> 0).toString(16).padStart(8, "0");
  }

  var ACCESS = window.ACCESS || { adminHash: "", codes: [] };
  var STORE_KEY = "ej_gate_code_v1";

  var gate = document.getElementById("gate");
  var gateBox = document.getElementById("gateBox");
  var adminPanel = document.getElementById("adminPanel");

  function todayStr() {
    var d = new Date();
    return d.getFullYear() + "-" +
      String(d.getMonth() + 1).padStart(2, "0") + "-" +
      String(d.getDate()).padStart(2, "0");
  }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function rand4() {
    var s = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    var r = "";
    for (var i = 0; i < 4; i++) r += s[Math.floor(Math.random() * s.length)];
    return r;
  }

  function codeIsValid(code) {
    if (!code) return false;
    var hsh = hash(code);
    for (var i = 0; i < ACCESS.codes.length; i++) {
      var c = ACCESS.codes[i];
      if (c.status === "active" && c.hash === hsh) return true;
    }
    return false;
  }

  function enterApp() {
    if (gate) gate.style.display = "none";
  }

  // 启动：若本地已存有效授权码则直接进入，否则显示闸门（CSS 默认覆盖）
  (function init() {
    var saved = "";
    try { saved = localStorage.getItem(STORE_KEY) || ""; } catch (e) {}
    if (codeIsValid(saved)) enterApp();
  })();

  // ---- 普通用户进入 ----
  var gateEnter = document.getElementById("gateEnter");
  var gateCode = document.getElementById("gateCode");
  var gateMsg = document.getElementById("gateMsg");
  if (gateEnter) {
    gateEnter.addEventListener("click", function () {
      var v = (gateCode.value || "").trim().toUpperCase();
      if (!v) { gateMsg.textContent = "请输入授权码"; return; }
      if (codeIsValid(v)) {
        try { localStorage.setItem(STORE_KEY, v); } catch (e) {}
        enterApp();
      } else {
        gateMsg.textContent = "授权码无效或已被停用";
      }
    });
    gateCode.addEventListener("keydown", function (e) {
      if (e.key === "Enter") gateEnter.click();
    });
  }

  // ---- 管理面板 ----
  var adminUnlocked = false;
  var adminMsg = document.getElementById("adminMsg");

  var adminLink = document.getElementById("gateAdminLink");
  if (adminLink) adminLink.addEventListener("click", function () {
    gateBox.classList.add("hidden");
    adminPanel.classList.remove("hidden");
    if (adminMsg) adminMsg.textContent = "";
  });
  var adminBack = document.getElementById("adminBack");
  if (adminBack) adminBack.addEventListener("click", function () {
    adminPanel.classList.add("hidden");
    gateBox.classList.remove("hidden");
  });

  var adminLoginBtn = document.getElementById("adminLoginBtn");
  if (adminLoginBtn) adminLoginBtn.addEventListener("click", function () {
    var p = (document.getElementById("adminPwd").value || "");
    if (hash(p) === ACCESS.adminHash) {
      adminUnlocked = true;
      document.getElementById("adminLogin").classList.add("hidden");
      document.getElementById("adminTools").classList.remove("hidden");
      renderCodes();
    } else {
      if (adminMsg) adminMsg.textContent = "管理密码错误";
    }
  });

  function renderCodes() {
    var box = document.getElementById("adminCodeList");
    if (!box) return;
    box.innerHTML = "";
    ACCESS.codes.forEach(function (c, idx) {
      var row = document.createElement("div");
      row.className = "admin-code-row";
      var statusTxt = c.status === "active" ? "启用" : "停用";
      row.innerHTML =
        '<span class="ac-note">' + escapeHtml(c.note || ("码" + (idx + 1))) + "</span>" +
        '<span class="ac-status ' + (c.status === "active" ? "on" : "off") + '">' + statusTxt + "</span>" +
        '<span class="ac-date">' + escapeHtml(c.created || "") + "</span>";
      var btn = document.createElement("button");
      btn.className = "ghost-btn small-btn";
      btn.textContent = c.status === "active" ? "停用" : "启用";
      btn.addEventListener("click", function () {
        c.status = c.status === "active" ? "revoked" : "active";
        renderCodes();
      });
      row.appendChild(btn);
      box.appendChild(row);
    });
  }

  var genBtn = document.getElementById("adminGenBtn");
  if (genBtn) genBtn.addEventListener("click", function () {
    if (!adminUnlocked) return;
    var note = window.prompt("给这个新授权码加个备注（可选，如 张三）：", "") || "";
    var code = "EJ-" + rand4() + "-" + rand4();
    ACCESS.codes.push({ hash: hash(code), note: note, status: "active", created: todayStr() });
    renderCodes();
    var nc = document.getElementById("adminNewCode");
    nc.value = code;
    nc.classList.remove("hidden");
    if (adminMsg) adminMsg.textContent = "已生成：" + code + "（请复制发给授权人；导出 access.js 重新部署后对他人才生效）";
  });

  var pwdBtn = document.getElementById("adminPwdChangeBtn");
  if (pwdBtn) pwdBtn.addEventListener("click", function () {
    if (!adminUnlocked) return;
    var np = window.prompt("设置新的管理密码：", "");
    if (!np) return;
    ACCESS.adminHash = hash(np);
    if (adminMsg) adminMsg.textContent = "管理密码已更新（导出 access.js 重新部署后生效）";
  });

  var expBtn = document.getElementById("adminExportBtn");
  if (expBtn) expBtn.addEventListener("click", function () {
    if (!adminUnlocked) return;
    var text = "window.ACCESS = " + JSON.stringify(ACCESS, null, 2) + ";\n";
    var blob = new Blob([text], { type: "text/javascript" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "access.js";
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
    if (adminMsg) adminMsg.textContent = "已导出 access.js，把它发给我重新部署即可生效。";
  });
})();
