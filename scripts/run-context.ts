import type {RunIdentity} from '../shared/domain.ts';
export function validateRunContext(run:RunIdentity,expected:{id:number;attempt:number;sha:string;number:number}):RunIdentity {
  if(run.id!==expected.id||run.run_attempt!==expected.attempt||run.head_sha!==expected.sha||run.run_number!==expected.number||!run.created_at||!Number.isFinite(Date.parse(run.created_at)))throw new Error('Actions 工作時間、流水號或版本不一致');
  return run;
}
