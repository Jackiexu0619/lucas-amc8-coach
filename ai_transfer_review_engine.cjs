'use strict';
// Isolated AI same-method review engine. Not wired to production BANK until editorial approval.
const DAY=86400000;
function isoDay(v){return new Date(v+'T00:00:00Z').toISOString().slice(0,10)}
function addDays(date,n){const d=new Date(date+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)}
function candidateApproved(q){return q && q.quality_status==='approved_for_review' && q.counts_for_exam_diagnostic===false && q.question && q.answer && q.method_group}
function selectSameMethodCandidate({wrongQuestion,candidates,attemptedIds=[],date,officialCandidates=[]}){
 const method=wrongQuestion?.method_group;
 if(!method) return {candidate:null,reason:'missing_method_group'};
 const seen=new Set(attemptedIds);
 const eligible=(arr)=>arr.filter(q=>q&&q.id!==wrongQuestion.id&&!seen.has(q.id)&&q.method_group===method);
 const official=eligible(officialCandidates).sort((a,b)=>(a.difficulty||3)-(b.difficulty||3));
 if(official.length) return {candidate:official[0],source:'official_transfer',reason:'same_method_official_first'};
 const ai=eligible(candidates).filter(candidateApproved).sort((a,b)=>(a.target_band||3)-(b.target_band||3));
 if(ai.length) return {candidate:ai[0],source:'ai_transfer_review',reason:'approved_ai_fallback'};
 return {candidate:null,reason:'no_approved_unseen_same_method_candidate'};
}
function scheduleAfterResult({currentDate,independentCorrectStreak=0,correct,guessed=false,hintLevel=0,errorType=null}){
 if(!correct) return {nextReview:addDays(currentDate,1),stage:0,mastered:false,reason:'incorrect_retry_next_training_day'};
 if(guessed||hintLevel>0) return {nextReview:addDays(currentDate,3),stage:independentCorrectStreak,mastered:false,reason:guessed?'guessed_does_not_advance':'hinted_does_not_advance'};
 const next=independentCorrectStreak+1;
 const days=next===1?7:next===2?14:30;
 return {nextReview:addDays(currentDate,days),stage:next,mastered:next>=3,reason:'independent_correct_advances_interval'};
}
function makeReviewAttempt({question,date,correct,selectedAnswer,guessed=false,hintLevel=0,durationSec=null,errorType=null,source='ai_transfer_review'}){
 if(!question||!question.id||question.counts_for_exam_diagnostic!==false) throw new Error('invalid_or_exam_eligible_question');
 if(durationSec!==null&&(!Number.isFinite(durationSec)||durationSec<0))throw new Error('invalid_duration');
 return {question_id:question.id,date,correct:!!correct,selected_answer:selectedAnswer??null,guessed:!!guessed,hint_level:hintLevel||0,duration_sec:durationSec,error_type:errorType,source,counts_for_exam_diagnostic:false,independent:!!correct&&!guessed&&!(hintLevel>0)};
}
module.exports={candidateApproved,selectSameMethodCandidate,scheduleAfterResult,makeReviewAttempt,addDays};
