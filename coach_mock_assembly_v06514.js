/* Lucas AMC8 Coach v0.6.5.14 — testable, position-preserving weekend mock selector. */
(function(root){
  'use strict';
  var DEFAULT_PERSONALIZED_POSITIONS=[5,9,12,15,18,21,24];

  function toSet(value){
    if(value instanceof Set)return value;
    return new Set(Array.isArray(value)?value:[]);
  }

  function selectArchiveMock(options){
    options=options||{};
    var archive=Array.isArray(options.archive)?options.archive:[];
    var attempted=toSet(options.attemptedIds);
    var recent=toSet(options.recentIds);
    var scores=options.weaknessScoreById&&typeof options.weaknessScoreById==='object'?options.weaknessScoreById:{};
    var positions=new Set((Array.isArray(options.personalizedPositions)?options.personalizedPositions:DEFAULT_PERSONALIZED_POSITIONS).map(Number));
    var random=typeof options.random==='function'?options.random:Math.random;
    var chosen=[],selection=[],usedIds=new Set(),yearUse=Object.create(null);

    if(!archive.length)return {ok:false,reason:'empty-archive',chosen:chosen,selection:selection};

    for(var pos=1;pos<=25;pos++){
      var eligible=archive.filter(function(q){
        return q&&q.id&&Number(q.problem_number)===pos&&!usedIds.has(q.id);
      });
      if(!eligible.length)return {ok:false,reason:'missing-position-'+pos,chosen:chosen,selection:selection};

      var pool=eligible.filter(function(q){return !attempted.has(q.id)&&!recent.has(q.id);});
      var fallback='fresh';
      if(!pool.length){
        pool=eligible.filter(function(q){return !recent.has(q.id);});
        fallback='older_nonrecent';
      }
      if(!pool.length){
        pool=eligible;
        fallback='last_resort_recent';
      }

      var personalized=positions.has(pos);
      var ranked=pool.map(function(q){
        var raw=Number(scores[q.id]);
        var weakness=personalized&&Number.isFinite(raw)?Math.max(0,raw):0;
        var year=String(q.year==null?'unknown':q.year);
        var used=yearUse[year]||0;
        var jitter=Number(random());
        if(!Number.isFinite(jitter))jitter=0;
        return {q:q,weakness:weakness,year:year,used:used,score:weakness-used*1.5,tie:jitter};
      });
      ranked.sort(function(a,b){
        if(b.score!==a.score)return b.score-a.score;
        return b.tie-a.tie;
      });

      var best=ranked[0],q=best.q;
      chosen.push(q);
      usedIds.add(q.id);
      yearUse[best.year]=(yearUse[best.year]||0)+1;
      selection.push({
        position:pos,
        question_id:q.id,
        year:q.year==null?null:Number(q.year),
        original_position:Number(q.problem_number),
        personalized:personalized,
        weakness_score:best.weakness,
        matched_weekly_weakness:best.weakness>0,
        fallback:fallback,
        candidate_count:pool.length,
        source_year_use_before:best.used
      });
    }

    return {
      ok:chosen.length===25,
      reason:chosen.length===25?'ok':'incomplete-paper',
      chosen:chosen,
      selection:selection,
      summary:{
        question_count:chosen.length,
        unique_question_count:usedIds.size,
        personalized_positions:selection.filter(function(x){return x.personalized;}).map(function(x){return x.position;}),
        weakness_matched_positions:selection.filter(function(x){return x.matched_weekly_weakness;}).map(function(x){return x.position;}),
        fallback_positions:selection.filter(function(x){return x.fallback!=='fresh';}).map(function(x){return x.position;}),
        source_years:Array.from(new Set(chosen.map(function(q){return q.year;}))).sort(function(a,b){return Number(a)-Number(b);})
      }
    };
  }

  var api={selectArchiveMock:selectArchiveMock,DEFAULT_PERSONALIZED_POSITIONS:DEFAULT_PERSONALIZED_POSITIONS.slice()};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(root)root.LucasAMC8MockAssemblyV06514=api;
})(typeof window==='undefined'?globalThis:window);
