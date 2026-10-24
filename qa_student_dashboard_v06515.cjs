'use strict';
const assert=require('node:assert/strict');
const {VERSION,weekdayOf,latestFullMock,dailySubmitted,buildDashboardModel}=require('./coach_student_dashboard_v06515.js');

assert.equal(VERSION,'0.6.5.15');
assert.equal(weekdayOf('2026-10-25'),0,'2026-10-25 is Sunday');
assert.equal(weekdayOf('2026-10-26'),1,'2026-10-26 is Monday');
assert.equal(latestFullMock({mock_detail_history:[{date:'2026-10-20',per_question:[]},{date:'2026-10-22',per_question:Array(25).fill({})}]}).date,'2026-10-22');
assert.equal(dailySubmitted({daily_plan:{date:'2026-10-26',submitted:true}},'2026-10-26'),true);
assert.equal(dailySubmitted({daily_plan:{date:'2026-10-25',submitted:true}},'2026-10-26'),false);

const paperIds=Array.from({length:25},(_,i)=>'archive_2018_'+String(i+1).padStart(2,'0'));
const pendingState={
  printable_mock_ids:paperIds,printable_mock_id:'AMC8-20261025-NEW',printable_mock_date:'2026-10-25',
  mock_detail_history:[{date:'2026-10-18',paper_id:'AMC8-20261018-OLD',score:18,per_question:Array(25).fill({})}],
  daily_plan:{date:'2026-10-25',question_ids:['a','b','c'],submitted:false},
  attempts:[],v065_review_cycle:{tasks:[{status:'pending'}]}
};
const before=JSON.stringify(pendingState);
const pending=buildDashboardModel(pendingState,'2026-10-25',{dailyQuestionCount:3,weakAttemptCount:2,weakFocus:[{method:'概率与补集',count:2}]});
assert.equal(pending.paperPending,true,'a newly locked paper must stay pending even when an older mock exists');
assert.equal(pending.next.target,'mock','the printed weekend paper is the next action');
assert.equal(pending.steps[0].status,'active','do not mark the current paper complete because an older mock exists');
assert.equal(pending.steps[1].status,'pending','do not diagnose the new paper before it is submitted');
assert.equal(pending.pendingReviewCount,1);
assert.equal(JSON.stringify(pendingState),before,'dashboard model must not mutate training state');

const submittedState={
  printable_mock_ids:paperIds,printable_mock_id:'AMC8-20261025-CURRENT',printable_mock_date:'2026-10-25',
  mock_detail_history:[{date:'2026-10-25',paper_id:'AMC8-20261025-CURRENT',score:20,per_question:Array(25).fill({})}],
  daily_plan:{date:'2026-10-25',question_ids:['a','b','c'],submitted:false},
  v065_review_cycle:{tasks:[]}
};
const submitted=buildDashboardModel(submittedState,'2026-10-25',{dailyQuestionCount:3});
assert.equal(submitted.paperPending,false,'a matching submitted paper is complete');
assert.equal(submitted.next.target,'report','weekend completion should lead to the learning report');

const weekdayState={daily_plan:{date:'2026-10-26',question_ids:['a','b','c'],submitted:false},v065_review_cycle:{tasks:[]}};
const weekday=buildDashboardModel(weekdayState,'2026-10-26',{dailyQuestionCount:3});
assert.equal(weekday.next.target,'practice','weekday priority is the light daily practice');
assert.equal(weekday.steps[2].status,'active');

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

console.log('PASS: '+VERSION+' guided dashboard model, locked-paper protection, weekend/weekday next action, and no state mutation.');
