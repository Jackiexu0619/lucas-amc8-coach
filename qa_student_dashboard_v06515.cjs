'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {VERSION,weekdayOf,latestFullMock,dailySubmitted,buildDashboardModel}=require('./coach_student_dashboard_v06515.js');

assert.equal(VERSION,'0.6.5.15');
assert.equal(weekdayOf('2026-10-25'),0,'2026-10-25 is Sunday');
assert.equal(weekdayOf('2026-10-26'),1,'2026-10-26 is Monday');

const fullOld={date:'2026-10-22',paper_id:'OLD',question_ids:Array.from({length:25},(_,i)=>'old_'+i),per_question:Array(25).fill({})};
const partialNew={date:'2026-10-24',paper_id:'PARTIAL',question_ids:['p1','p2'],per_question:[{},{}]};
assert.equal(latestFullMock({mock_detail_history:[fullOld,partialNew]}).date,'2026-10-22',
  'a newer partial record must not replace the latest complete 25-question mock');
assert.equal(dailySubmitted({daily_plan:{date:'2026-10-26',submitted:true}},'2026-10-26'),true);
assert.equal(dailySubmitted({daily_plan:{date:'2026-10-25',submitted:true}},'2026-10-26'),false);

const paperIds=Array.from({length:25},(_,i)=>'archive_2018_'+String(i+1).padStart(2,'0'));
const oldIds=Array.from({length:25},(_,i)=>'archive_2017_'+String(i+1).padStart(2,'0'));
const pendingState={
  printable_mock_ids:paperIds,printable_mock_id:'AMC8-20261025-NEW',printable_mock_date:'2026-10-25',
  mock_detail_history:[{date:'2026-10-18',paper_id:'AMC8-20261018-OLD',score:18,question_ids:oldIds,per_question:Array(25).fill({})}],
  daily_plan:{date:'2026-10-25',question_ids:['a','b','c'],submitted:false},
  attempts:[],v065_review_cycle:{tasks:[{status:'pending'}]}
};
const before=JSON.stringify(pendingState);
const pending=buildDashboardModel(pendingState,'2026-10-25',{dailyQuestionCount:3,weakAttemptCount:2,weakFocus:[{skill:'概率与补集',method:'补集法',count:2}]});
assert.equal(pending.paperPending,true,'a newly locked paper must stay pending even when an older mock exists');
assert.equal(pending.next.target,'mock','the printed weekend paper is the next action');
assert.equal(pending.steps[0].status,'active','do not mark the current paper complete because an older mock exists');
assert.ok(pending.steps[0].description.includes('当前纸质卷'),'do not describe an older mock as the current paper');
assert.equal(pending.steps[1].status,'pending','do not diagnose the new paper before it is submitted');
assert.equal(pending.pendingReviewCount,1);
assert.equal(JSON.stringify(pendingState),before,'dashboard model must not mutate training state');

const submittedState={
  printable_mock_ids:paperIds,printable_mock_id:'AMC8-20261025-CURRENT',printable_mock_date:'2026-10-25',
  mock_detail_history:[{date:'2026-10-25',paper_id:'AMC8-20261025-CURRENT',score:20,question_ids:paperIds,per_question:Array(25).fill({})}],
  daily_plan:{date:'2026-10-25',question_ids:['a','b','c'],submitted:false},
  v065_review_cycle:{tasks:[]}
};
const submitted=buildDashboardModel(submittedState,'2026-10-25',{dailyQuestionCount:3});
assert.equal(submitted.paperPending,false,'a matching submitted paper is complete');
assert.equal(submitted.currentPaperComplete,true,'Saturday/Sunday paper in the current week is complete');
assert.equal(submitted.next.target,'report','weekend completion should lead to the learning report');

const weekdayState={daily_plan:{date:'2026-10-26',question_ids:['a','b','c'],submitted:false},v065_review_cycle:{tasks:[]}};
const weekday=buildDashboardModel(weekdayState,'2026-10-26',{dailyQuestionCount:3});
assert.equal(weekday.next.target,'practice','weekday priority is the light daily practice');
assert.equal(weekday.steps[2].status,'active');

const staleDailyState={daily_plan:{date:'2026-10-24',question_ids:['a','b','c'],submitted:false},v065_review_cycle:{tasks:[]}};
const staleDaily=buildDashboardModel(staleDailyState,'2026-10-25',{dailyQuestionCount:3});
assert.equal(staleDaily.oldDailyPlanPending,true,'an unsubmitted older daily paper remains locked');
assert.equal(staleDaily.next.target,'practice');
assert.ok(staleDaily.next.detail.includes('2026-10-24'),'do not mislabel a prior locked paper as today\'s paper');
assert.ok(staleDaily.steps[2].description.includes('2026-10-24'));

const previousWeekPaper={
  printable_mock_ids:paperIds,printable_mock_id:'AMC8-20261018-OLD',printable_mock_date:'2026-10-18',
  mock_detail_history:[{date:'2026-10-18',paper_id:'AMC8-20261018-OLD',score:18,question_ids:paperIds,per_question:Array(25).fill({})}],
  v065_review_cycle:{tasks:[]}
};
const previousWeek=buildDashboardModel(previousWeekPaper,'2026-10-25',{dailyQuestionCount:0});
assert.equal(previousWeek.paperPending,false,'a completed previous-week paper is not pending');
assert.equal(previousWeek.currentPaperComplete,false,'last week\'s paper is not the current weekend paper');
assert.equal(previousWeek.next.target,'mock','a completed previous-week paper should not block the current weekend flow');
assert.equal(previousWeek.steps[0].status,'pending');

const followupState={
  daily_plan:{date:'2026-10-27',question_ids:['a','b','c'],submitted:true},
  daily_sessions:[],
  v065_review_cycle:{tasks:[{status:'pending'},{status:'pending'},{status:'completed'}]}
};
const followup=buildDashboardModel(followupState,'2026-10-27',{dailyQuestionCount:3});
assert.equal(followup.dailyDone,true);
assert.equal(followup.next.target,'report','after daily completion, due transfer tasks lead to the report');
assert.equal(followup.pendingReviewCount,2);
assert.equal(followup.completedReviewCount,1);
assert.equal(followup.steps[3].status,'active');

const source=fs.readFileSync(require.resolve('./coach_student_dashboard_v06515.js'),'utf8');
assert.ok(!source.includes('<button'), 'the dashboard must not add duplicate navigation buttons');

console.log('PASS: '+VERSION+' dashboard model, full-mock detection, exact paper identity, current-week state, locked daily paper, no extra buttons, and no state mutation.');
