/* Relation practice is self-authored from the cited study cards, never labelled as an exam paper. */
(function (root) {
  'use strict';
  function buildQuestions(people) {
    const out = [];
    const by=Object.fromEntries(people.map(p=>[p.id,p]));
    const examples=[
      ['gaudi','高迪属于哪一条主要运动线索？为什么不选维也纳分离派？','新艺术运动；在西班牙语境中还应联系加泰罗尼亚现代主义。维也纳分离派是相关的维也纳艺术组织，高迪不是其成员。'],
      ['schinkel','柏林老博物馆：在“浪漫主义／折衷主义／希腊复兴／罗马复兴”中，哪项最准确？','希腊复兴；上位思潮是古典复兴，设计人为申克尔。注意题目问的是细分取向。'],
      ['gropius','哈佛大学研究生中心：设计者与战后创作倾向如何对应？','格罗皮乌斯与TAC协和建筑师事务所同人合作；教材归入“对理性主义进行充实与提高的倾向”。'],
      ['rossi','罗西与格拉西的理论著作分别是什么？','罗西：《城市建筑学》（1966）；格拉西：《建筑的逻辑构成》（1967），教材旧译《建筑的结构逻辑》等。两人均联系新理性主义。'],
      ['paxton','1851年伦敦第一届世界博览会场馆是什么？把作品、人物、技术线索连起来。','水晶宫—帕克斯顿—铁与玻璃、预制装配和工业化建造的早期探索。'],
      ['ledoux','法国皇家盐场对应哪位建筑师？应联系哪一条历史线索？','勒杜；18世纪法国启蒙时代的古典复兴与几何化探索。不要和17世纪法国古典主义混为同一时期。']
    ];
    examples.forEach(([id,prompt,answer])=>{if(by[id])out.push({id:'example:'+id,type:'example',title:'按所附题型改编',prompt,answer,trap:by[id].trap,personId:id,sourceRef:by[id].sourceRef});});
    people.forEach((p) => {
      out.push({id:'person:'+p.id, type:'person', title:'人物 → 思潮与作品', prompt:p.name+'：说出其思想或流派线索，再举一部作品说明。', answer:p.era+'；'+p.idea+' 例：'+p.works[0][0]+'（'+p.works[0][1]+'），'+p.works[0][2]+'。', trap:p.trap, personId:p.id, sourceRef:p.sourceRef || '沿用首版学习卡；教材页码待定位'});
      out.push({id:'idea:'+p.id, type:'idea', title:'思想 → 人物', prompt:'哪位人物可用于说明这一立场？请同时举一部作品。\n'+p.idea, answer:p.name+'；'+p.era+'。例：'+p.works[0][0]+'（'+p.works[0][1]+'）。这是开放式自拟题，合理的其他例证也可成立。', trap:p.trap, personId:p.id, sourceRef:p.sourceRef || '沿用首版学习卡；教材页码待定位'});
      p.works.forEach((w,i) => out.push({id:'work:'+p.id+':'+i, type:'work', title:'作品／著作 → 作者、时间与思想', prompt:w[0].replace(/（(?:由|与).*?）/g,'')+'：作者是谁？约在何时？用哪个思想关键词解释？', answer:((p.workCredits||{})[i]||p.name)+'；'+w[1]+'；'+p.era+'。'+w[2]+'。', trap:p.trap, personId:p.id, sourceRef:p.sourceRef || '沿用首版学习卡；教材页码待定位'}));
    });
    // Only use works with a single exact four-digit date: ranges and proposals are not ordered as completions.
    const dated = people.filter(p=>p.sourceRef).flatMap(p=>p.works.filter(w=>/^\d{4}$/.test(w[1])).map(w=>({name:w[0],year:+w[1],personId:p.id,sourceRef:p.sourceRef})));
    dated.sort((a,b)=>a.year-b.year || a.name.localeCompare(b.name));
    for(let i=0;i+2<dated.length;i+=3) {
      const set=dated.slice(i,i+3);
      if(new Set(set.map(x=>x.year)).size!==3) continue;
      const display=[set[2],set[0],set[1]];
      out.push({id:'time:'+set.map(x=>x.personId+'-'+x.year).join(':'),type:'time',title:'时间 → 先后顺序',prompt:'按卡片所列年代，从早到晚排列：\n'+display.map((x,j)=>(j+1)+'. '+x.name).join('\n'),answer:set.map(x=>x.name+'（'+x.year+'）').join(' → '),trap:'这些年份沿用作品卡的年代口径，不把设计、建造、开放混为同一个事件。',sourceRef:[...new Set(set.map(x=>x.sourceRef||'首版学习卡，页码待定位'))].join('；')});
    }
    return out;
  }
  root.ArchitectStudy={buildQuestions};
})(typeof window!=='undefined'?window:globalThis);
