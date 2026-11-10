export const timezone='Asia/Qyzylorda';
export function today(){return new Date().toLocaleDateString('sv-SE',{timeZone:timezone});}
export function addDays(date,n){const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);}
export function weekStart(date){const d=new Date(date+'T12:00:00Z');return addDays(date,-((d.getUTCDay()+6)%7));}
export function dayIndex(date){return (new Date(date+'T12:00:00Z').getUTCDay()+6)%7;}
export function summary(session){const items=session?.items||[],marks=session?.marks||{},total=items.reduce((n,i)=>n+i.sets,0),done=items.reduce((n,i)=>n+Array.from({length:i.sets},(_,s)=>marks[`${i.id}:${s}`]===true).filter(Boolean).length,0),complete=items.filter(i=>Array.from({length:i.sets},(_,s)=>marks[`${i.id}:${s}`]===true).every(Boolean)).length;return {total,done,complete,percent:total?Math.round(done/total*100):0};}
export function estimatedMinutes(plan){return Math.round(5+(plan?.items||[]).reduce((n,i)=>n+i.sets*(40+i.rest)/60,0));}
export const formatDate=(date,options={day:'numeric',month:'long'})=>new Date(date+'T12:00:00Z').toLocaleDateString('ru-RU',{...options,timeZone:'UTC'});
export const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function firstPendingSet(session) {
  const marks = session.marks || {};
  for (const [exerciseIndex, item] of session.items.entries()) {
    for (let setIndex = 0; setIndex < item.sets; setIndex++) {
      if (marks[`${item.id}:${setIndex}`] !== true) return {item, exerciseIndex, setIndex};
    }
  }
  return null;
}

export function plannedWorkout(data,date) {
 const id=data.schedule?.weekdays?.[dayIndex(date)];
 return data.plans.find(plan=>plan.id===id);
}

export function sessionForDate(data,date) {
 const sessions=data.sessions.filter(session=>session.workout_date===date);
 const scheduledId=plannedWorkout(data,date)?.id;
 return sessions.find(session=>!session.finished_at&&session.plan_id===scheduledId)||
   sessions.find(session=>!session.finished_at)||
   sessions.find(session=>session.plan_id===scheduledId)||sessions[0];
}

export function todaySelection(data, date) {
  const scheduledId = data.schedule?.weekdays?.[dayIndex(date)];
  const recent = data.sessions.filter(session => session.workout_date >= addDays(date, -7) && session.workout_date <= date);
  recent.sort((a, b) => b.workout_date.localeCompare(a.workout_date) || String(b.started_at).localeCompare(String(a.started_at)));
  const todaysSessions = recent.filter(session => session.workout_date === date);
  const session = todaysSessions.find(item => !item.finished_at)
    || todaysSessions.find(item => item.plan_id === scheduledId)
    || (!scheduledId ? todaysSessions[0] : null);
  return {
    plan: data.plans.find(plan => plan.id === (session?.plan_id || scheduledId)),
    session,
    previous: recent.find(item => item.workout_date < date && !item.finished_at)
  };
}
