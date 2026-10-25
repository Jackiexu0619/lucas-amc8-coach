'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'coach_review_cycle_v065.js'),'utf8');

function question(id,problem_number,year,skill,group_key){
 return {id,problem_number,year,skill,domain:'misc',core_method:group_key||skill};
}
const oldPlan=[
 question('archive_2002_20',20,2002,'旧卷题一','old_20'),
 question('archive_2000_16',16,2000,'旧卷题二','old_16'),
 question('archive_2000_17',17,2000,'旧卷题三','old_17')
];
const sources=[
 question('archive_2009_15',15,2009,'比例关系','ratio'),
 question('archive_2005_19',19,2005,'面积与面积比','area_ratio'),
 question('archive_2008_24',24,2008,'概率与补集','probability_complement'),
 question('archive_2016_25',25,2016,'相似直角三角形','similar_right_triangle')
];
const candidates=[
 question('archive_2017_15',15,2017,'比例关系','ratio'),
 question('archive_2018_19',19,2018,'面积与面积比','area_ratio'),
 question('archive_2015_24',24,2015,'概率与补集','probability_complement'),
 question('archive_2012_25',25,2012,'相似直角三角形','similar_right_triangle')
];
const fill=[
 question('archive_2019_18',18,2019,'广度题一','breadth_18'),
 question('archive_2020_21',21,2020,'广度题二','breadth_21'),
 question('archive_2022_22',22,2022,'广度题三','breadth_22')
];
const all=[...oldPlan,...sources,...fill,...candidates];
const byId=new Map(all.map(q=>[q.id,q]));
const oldIds=new Set(oldPlan.map(q=>q.id));
const attemptedIds=new Set(sources.map(q=>q.id));
const skillTags={};
for(const q of [...sources,...candidates]){
 skillTags[q.id]={status:'pdf_explanation_reviewed',skill:q.skill,method:'同方法 '+q.skill,group_key:q.core_method};
}
const S={
 attempts:sources.map((q,i)=>({question_id:q.id,date:'2026-10-24',source:'weekend_mock',
  correct:false,guessed:false,result_status:i===1||i===3?'unable':'wrong',error_type:null})),
 v064_specific_skills:skillTags,
 v064_question_tags:{},
 mock_detail_history:[],
 printable_mock_ids:[]
};
const window={amc8V0641PickDaily:()=>oldPlan};
const ctx={
 window,S,
 today:()=> '2026-10-27',
 saveStateLocal:()=>{},
 qById:id=>byId.get(id)||null,
 eligibleDailyBank:()=>[...fill,...candidates].filter(q=>!oldIds.has(q.id)&&!attemptedIds.has(q.id)),
 generateDailyPlan:()=>oldPlan,
 dailyPlan:()=>oldPlan,
 questionPromptHtml:()=> '',
 questionSourceBadge:()=> '',
 renderReport:()=>{},
 renderMock:()=>{},
 currentDraft:()=>({error_types:{}}),
 ensurePaperId:()=> '2026-W43-01',
 submitPrintableMockAnswers:()=>{},
 submitDailyPaperResults:()=>{},
 renderAll:()=>{},
 safe:v=>String(v),
 console
};
vm.createContext(ctx);
vm.runInContext(source,ctx,{filename:'coach_review_cycle_v065.js'});

const before=S.v065_review_cycle.tasks.filter(t=>t.origin==='weekend_mock');
assert.equal(before.length,4,'all four weekend weak questions should create review tasks');
assert.ok(before.every(t=>t.due==='2026-10-27'),'weekend review tasks should be due on the next training day');

const regenerated=ctx.generateDailyPlan(new Set(oldPlan.map(q=>q.id)));
assert.equal(regenerated.length,3,'regenerating a locked paper must still produce three questions');
assert.equal(new Set(regenerated.map(q=>q.id)).size,3,'regenerated questions must be unique');
assert.ok(regenerated.every(q=>!oldIds.has(q.id)),'every question from the old locked paper must be excluded');
assert.ok(regenerated.some(q=>q.id==='archive_2018_19'),'due area-ratio transfer should survive regeneration');
assert.ok(regenerated.some(q=>q.id==='archive_2012_25'),'due similar-triangle transfer should survive regeneration');
assert.equal(window.amcV065Planned.length,2,'at most two explicit due-review slots should be assigned');
assert.deepEqual(window.amcV065Planned.map(x=>x.skill).sort(),['相似直角三角形','面积与面积比'].sort(),
 'highest-priority due weekend tasks should be selected first');

console.log('PASS: weekend weak tasks survive explicit daily-paper regeneration, old paper IDs remain excluded, and the daily limit stays at three.');
