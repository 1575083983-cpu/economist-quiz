// 修复：人力(2026) 等章节在题库中缺少 id 字段，导致 app.js 用 _chapterId === ch.id
// 匹配时全部命中 undefined，使得每个无 id 章节都显示/刷到“全部该类题目”。
// 本脚本在 app.js 扁平化之前，为所有缺少 id 的章节补上稳定 id（幂等，仅补缺失）。
// 这样现有全部 _chapterId === ch.id 比较自动正确，无需改动 app.js，也无需重传题库。
(function () {
  if (!window.QUESTIONS || !window.QUESTIONS.chapters) return;
  var n = 0;
  window.QUESTIONS.chapters.forEach(function (ch) {
    if (ch.id == null || ch.id === "") {
      ch.id = "hr-" + (++n);
    }
  });
})();
