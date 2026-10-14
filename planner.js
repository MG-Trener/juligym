import { exercises, days as templates } from './exercises.js';
import { stretches } from './stretches.js';

export const weekdays = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'];
export const shorts = ['ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ', 'ВС'];
export const groups = [
  { title: 'Ноги', items: ['squat', 'calf'] },
  { title: 'Ягодицы', items: ['bridge', 'hinge', 'side'] },
  { title: 'Спина', items: ['row'] },
  { title: 'Грудь', items: ['wall'] },
  { title: 'Плечи', items: ['press'] },
  { title: 'Руки', items: ['curl'] },
  { title: 'Мышцы корпуса', items: ['heel', 'bird'] }
];
const patterns = { squat:'legs', calf:'calves', bridge:'hinge', hinge:'hinge', side:'hip', row:'pull', wall:'push', press:'push', curl:'arms', heel:'core', bird:'core' };
const reasons = { legs:'Добавляет работу передней поверхности бедра', calves:'Дополняет работу ног нагрузкой на икры', hinge:'Добавляет работу ягодиц и задней поверхности бедра', hip:'Дополняет тренировку боковой поверхности ягодиц', pull:'Добавляет тяговое движение для спины', push:'Добавляет жимовое движение для груди или плеч', arms:'Добавляет отдельную работу для рук', core:'Дополняет тренировку контролем корпуса' };
const priorities = {
  squat:['row','wall','heel','bridge','press','bird','side','curl','calf','hinge'],
  bridge:['row','wall','heel','squat','press','bird','calf','curl','side','hinge'],
  hinge:['wall','row','bird','squat','press','heel','calf','curl','side','bridge'],
  row:['squat','wall','heel','bridge','press','bird','calf','side','curl','hinge'],
  wall:['row','squat','heel','bridge','bird','side','calf','curl','hinge','press'],
  press:['row','bridge','heel','squat','bird','calf','side','curl','hinge','wall'],
  calf:['squat','row','wall','heel','bridge','press','bird','side','curl','hinge'],
  side:['squat','row','heel','wall','bridge','press','bird','calf','curl','hinge'],
  curl:['squat','wall','heel','bridge','row','press','bird','side','calf','hinge'],
  heel:['squat','row','wall','bridge','press','side','calf','curl','hinge','bird'],
  bird:['squat','wall','row','bridge','press','side','calf','curl','hinge','heel']
};

export function recommendations(selected, included = []) {
  if (!exercises[selected]) return [];
  const used = new Set([selected, ...included]);
  const covered = new Set([...used].map(id=>patterns[id]));
  const result = [];
  const candidates = priorities[selected].filter(id=>!used.has(id));
  while (result.length < 3 && candidates.length) {
    const index = Math.max(0, candidates.findIndex(id=>!covered.has(patterns[id])));
    const [id] = candidates.splice(index,1);
    result.push({id, reason:reasons[patterns[id]]});
    covered.add(patterns[id]);
  }
  return result;
}

export function initialPlanner(stored = {}) {
  const plans = Array.from({length:7},(_,i)=>{
    const original = templates[i];
    const saved = Array.isArray(stored.plans) ? stored.plans.find(p=>p?.id===i+1) : null;
    const validItems = saved && Array.isArray(saved.items) ? [...new Set(saved.items.filter(id=>Object.hasOwn(exercises,id)))] : original?.items.slice() || [];
    const stretchItems=Array.isArray(saved?.stretches)?[...new Set(saved.stretches.filter(id=>Object.hasOwn(stretches,id)))]:[];
    return {id:i+1, title:typeof saved?.title==='string' ? saved.title.slice(0,60) : original?.title || `Мой комплекс ${i+1}`, items:validItems, stretches:stretchItems};
  });
  const schedule = Array.isArray(stored.schedule) ? stored.schedule.filter((s,i,a)=>s && Number.isInteger(s.weekday) && s.weekday>=0 && s.weekday<7 && Number.isInteger(s.planId) && s.planId>=1 && s.planId<=7 && a.findIndex(x=>x?.weekday===s.weekday)===i && a.findIndex(x=>x?.planId===s.planId)===i).sort((a,b)=>a.weekday-b.weekday) : [{weekday:0,planId:1},{weekday:2,planId:2},{weekday:4,planId:3}];
  if (!schedule.length) schedule.push({weekday:0,planId:1});
  return { plans, schedule, day:schedule.some(s=>s.planId===stored.day) ? stored.day : schedule[0].planId };
}

export function resizeSchedule(schedule, count) {
  count = Math.min(7,Math.max(1,Math.trunc(Number(count))||1));
  const priority = [0,2,4,6,1,3,5];
  const result = schedule.slice().sort((a,b)=>priority.indexOf(a.weekday)-priority.indexOf(b.weekday)).slice(0,count).map(s=>({...s}));
  for (const weekday of priority) {
    if(result.length>=count) break;
    if(result.some(s=>s.weekday===weekday)) continue;
    const planId = [1,2,3,4,5,6,7].find(id=>!result.some(s=>s.planId===id));
    result.push({weekday,planId});
  }
  return result.sort((a,b)=>a.weekday-b.weekday);
}

export function hasAdjacentDays(schedule) {
  const active = new Set(schedule.map(s=>s.weekday));
  return [...active].some(day=>active.has((day+1)%7));
}

export function updateItems(state, planId, nextItems) {
  const plan = state.plans.find(p=>p.id===planId);
  if(!plan) return;
  plan.items = [...new Set(nextItems.filter(id=>Object.hasOwn(exercises,id)))];
  for (const mode of ['easy','regular']) {
    const s = state.sessions[`${planId}:${mode}`];
    if(!s || typeof s!=='object') continue;
    s.done = s.finished ? [] : (Array.isArray(s.done) ? s.done.filter(key=>typeof key==='string' && plan.items.includes(key.split(':')[0])) : []);
    if(s.finished) s.stretchDone = [];
    s.finished = false;
  }
}
