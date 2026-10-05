import {coachInput} from './knowledge.js';
import {basicCoachAdvice,actionLabel,COACH_WEIGHTS} from './evaluation.js';
import {searchPublicLines} from '../planning/publicLines.js';

export function recommendMove(source,{enabled=false,level=1,manualWeaknesses}={}){
  if(!enabled)return {available:false,lines:[]};
  const input=coachInput(source,level,manualWeaknesses);
  const basic=basicCoachAdvice(input);
  if(!basic.available||input.knowledge.level<3)return basic;
  const search=searchPublicLines(input.view,input.knowledge,COACH_WEIGHTS,basic.alternatives.map(a=>a.action));
  const alternatives=basic.alternatives.map(a=>{
    const line=search.lines.find(l=>JSON.stringify(l.action)===JSON.stringify(a.action));
    return {...a,score:a.score+(line?.score??0)*COACH_WEIGHTS.LOOKAHEAD,line};
  }).sort((a,b)=>b.score-a.score||JSON.stringify(a.action).localeCompare(JSON.stringify(b.action)));
  const chosen=alternatives[0];
  const format=line=>{
    const steps=[];
    for(const step of line.steps){
      if(step.kind==='reply'||step.kind==='condition'){if(steps.length)steps[steps.length-1]+=' '+step.text;}
      else steps.push(step.text);
    }
    return {steps:steps.slice(0,4),remaining:line.remaining,depth:line.depth};
  };
  const lines=alternatives.filter(a=>a.line&&chosen.score-a.score<=8).slice(0,2).map(a=>format(a.line));
  return {available:true,action:chosen.action,label:actionLabel(chosen.action,input.view.hand),reasons:chosen.reasons.slice(-3),
    lines,alternatives,search:{nodes:search.totalNodes,limits:search.limits}};
}
