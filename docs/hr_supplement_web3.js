// HR(2026) round-3 preliminary supplement (6 questions). One per thin chapter to bring each from 11 to 12.
// Sourced from authoritative prep sites (正保会计网校 / 经济师考试网). Merged into window.QUESTIONS at load time.
window.HR_SUPPLEMENT_WEB3 = {
"人力(2026)·一5 法律责任与行政执法":[
  {"id":"web3-1","chapter":"人力(2026)·一5 法律责任与行政执法","stem":"关于劳动监察的属性，下列说法正确的有？","options":["法定性","行政性","专门性","强制性","道德性"],"answer":[0,1,2,3],"multi":true,"analysis":"劳动监察的属性包括法定性、行政性、专门性、强制性；道德性不属于劳动监察的属性范围。【来源：正保会计网校《中级经济师·人力资源管理》练习题精选(三)】","source":"正保会计网校(chinaacc.com)","supplement":true,"round":3}
],
"人力(2026)·一7 人才激励保障政策":[
  {"id":"web3-2","chapter":"人力(2026)·一7 人才激励保障政策","stem":"以技术转让或者许可方式转化职务科技成果的，应当从技术转让或者许可所取得的净收入中提取不低于（ ）的比例用于奖励职务科技成果完成人和为成果转化做出重要贡献的其他人员。","options":["10%","20%","30%","50%"],"answer":[3],"multi":false,"analysis":"以技术转让或者许可方式转化职务科技成果的，应当从技术转让或者许可所取得的净收入中提取不低于50%的比例用于奖励职务科技成果完成人和为成果转化做出重要贡献的其他人员。【来源：正保会计网校《中级经济师·人力资源管理》练习题精选(三)】","source":"正保会计网校(chinaacc.com)","supplement":true,"round":3}
],
"人力(2026)·一8 人才管理使用政策":[
  {"id":"web3-3","chapter":"人力(2026)·一8 人才管理使用政策","stem":"经营性人力资源服务机构开展人力资源管理咨询等业务的，应当自开展业务之日起（ ）内向人力资源社会保障行政部门备案。","options":["5日","7日","10日","15日"],"answer":[3],"multi":false,"analysis":"经营性人力资源服务机构开展人力资源供求信息的收集和发布、就业和创业指导、人力资源管理咨询、人力资源测评、人力资源培训、承接人力资源服务外包等业务的，应当自开展业务之日起15日内向人力资源社会保障行政部门备案。【来源：正保会计网校《中级经济师·人力资源管理》练习题精选(十)】","source":"正保会计网校(chinaacc.com)","supplement":true,"round":3}
],
"人力(2026)·一9 人力资源开发与流动配置政策":[
  {"id":"web3-4","chapter":"人力(2026)·一9 人力资源开发与流动配置政策","stem":"关于人力资源的流动与配置，下列说法正确的是？","options":["人力资源的流动与配置是发挥人才潜力的前提条件","人力资源流动只会降低组织效率","人才流动配置与激励保障无关","人力资源流动主要由政府强制安排"],"answer":[0],"multi":false,"analysis":"人力资源的流动与配置是发挥人才潜力的前提条件；合理的人才流动与配置有助于优化人才结构、激发人才活力，并非只会降低效率，也不是由政府强制安排。【来源：正保会计网校《中级经济师·人力资源管理》练习题精选(十)】","source":"正保会计网校(chinaacc.com)","supplement":true,"round":3}
],
"人力(2026)·三3 人员甄选":[
  {"id":"web3-5","chapter":"人力(2026)·三3 人员甄选","stem":"关于公文筐测试的特点，下列说法正确的有？","options":["操作复杂，对场地要求高","不能考察被测试者的人际交往能力","编制成本较高，评分较困难","具有较高的内容效度和效标效度"],"answer":[1,2,3],"multi":true,"analysis":"公文筐测试的优点包括：非常适合评价管理职位应聘者，具有较高的内容效度和效标效度，操作比较简单、对场地要求不高；缺点包括：编制成本较高、评分较困难，且无法考查被测试者的人际交往能力。因此“操作复杂、对场地要求高”并非其特点。【来源：正保会计网校《中级经济师·人力资源管理》练习题精选(三十五)】","source":"正保会计网校(chinaacc.com)","supplement":true,"round":3}
],
"人力(2026)·三4 绩效管理":[
  {"id":"web3-6","chapter":"人力(2026)·三4 绩效管理","stem":"关于绩效辅导的步骤，下列说法错误的是？","options":["绩效辅导的第一步是收集资料","制订计划位于给予信心之后","探索可能位于达成一致之后","给予信心是最后一个步骤"],"answer":[1],"multi":false,"analysis":"绩效辅导的步骤依次为：①收集资料；②定好基调；③达成一致；④探索可能；⑤制订计划；⑥给予信心。因此“制订计划位于给予信心之后”的说法错误，制订计划在给予信心之前。【来源：经济师考试网《2026年中级经济师人力资源考试题库：绩效计划与绩效监控及辅导》】","source":"经济师考试网(jjsedu.org)","supplement":true,"round":3}
]
};
(function(){
  if(!window.QUESTIONS || !window.QUESTIONS.chapters) return;
  var map = {};
  window.QUESTIONS.chapters.forEach(function(ch){ map[ch.name] = ch; });
  var sup = window.HR_SUPPLEMENT_WEB3 || {};
  Object.keys(sup).forEach(function(name){
    var ch = map[name];
    if(!ch){ ch = { name: name, questions: [] }; window.QUESTIONS.chapters.push(ch); map[name] = ch; }
    sup[name].forEach(function(q){ ch.questions.push(q); });
  });
})();
