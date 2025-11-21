// Chart page JS (timeline + alarm)
const timeline = document.getElementById('timeline');
const alarmPopup = document.getElementById('alarmPopup');
const alarmTitle = document.getElementById('alarmTitle');
const alarmWhen = document.getElementById('alarmWhen');
const dismissBtn = document.getElementById('dismissBtn');
const snoozeBtn = document.getElementById('snoozeBtn');
const alarmAudio = document.getElementById('alarmAudio');
const themeBtn = document.getElementById('themeBtn');

let tasks = JSON.parse(localStorage.getItem('planova-tasks') || '[]');

// Show theme same as other pages
function applyTheme(t){ document.documentElement.setAttribute('data-theme', t); localStorage.setItem('planova-theme', t); themeBtn.textContent = t==='dark' ? '🌞':'🌗'; }
applyTheme(localStorage.getItem('planova-theme') || 'light');
themeBtn.addEventListener('click', () => {
  const cur = document.documentElement.getAttribute('data-theme') || 'light';
  applyTheme(cur === 'dark' ? 'light' : 'dark');
});

// Sort tasks by start time (HH:MM)
tasks.sort((a,b)=> (a.start > b.start ? 1 : -1));
function renderTimeline(){
  timeline.innerHTML = '';
  if(tasks.length === 0){
    timeline.innerHTML = '<p class="small">No tasks added yet. Go to planner and add tasks.</p>';
    return;
  }
  tasks.forEach(t=>{
    const div = document.createElement('div');
    div.className = 'entry';
    div.innerHTML = `
      <div class="meta">
        <div class="time">${t.start} → ${t.end}</div>
        <div>
          <div class="taskname">${escapeHtml(t.name)}</div>
          <div class="small">Start: ${t.start} • End: ${t.end}</div>
        </div>
      </div>
      <div class="small">${t.duration? t.duration : ''}</div>
    `;
    timeline.appendChild(div);
  });
}
function escapeHtml(s){ return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
renderTimeline();

// ALARM logic:
// We will trigger alarm at exact minute when current HH:MM equals start or end time.
// To avoid replaying repeatedly in same minute, maintain an in-memory map of triggered keys with lastTriggered minute.
// Dismiss sets a block for that trigger for next 1 minute. Snooze delays next allowed trigger by 5 minutes.

let triggered = {}; // { "<taskId>-start": "YYYY-MM-DDTHH:MM", "<taskId>-end": "..." }

function nowHHMM(){
  const d = new Date();
  const hh = String(d.getHours()).padStart(2,'0');
  const mm = String(d.getMinutes()).padStart(2,'0');
  return `${hh}:${mm}`;
}
function nowKeyMinute(){
  const d = new Date();
  d.setSeconds(0,0);
  return d.toISOString(); // minute-precision
}

// check every second (fast response)
setInterval(checkAlarms, 1000);
function checkAlarms(){
  if(!tasks || tasks.length===0) return;
  const current = nowHHMM();
  const minuteKey = nowKeyMinute();

  tasks.forEach(t=>{
    // start
    const startKey = `${t.id}-start`;
    if(t.start === current){
      if(triggered[startKey] !== minuteKey){
        // new trigger
        triggered[startKey] = minuteKey;
        showAlarm(t, 'Start');
      }
    }
    // end
    const endKey = `${t.id}-end`;
    if(t.end === current){
      if(triggered[endKey] !== minuteKey){
        triggered[endKey] = minuteKey;
        showAlarm(t, 'End');
      }
    }
  });
}

// Show alarm UI & play audio
let currentAlarm = null;
function showAlarm(task, when){
  currentAlarm = { task, when, triggeredAt: Date.now() };
  alarmTitle.textContent = `Time ${when}: ${task.name}`;
  alarmWhen.textContent = `${when} • ${when === 'Start' ? task.start : task.end}`;
  alarmPopup.classList.remove('hidden');
  try {
    alarmAudio.currentTime = 0;
    alarmAudio.play().catch(()=>{ /* autoplay blocked maybe */ });
  } catch(e){}
}

// Dismiss
dismissBtn.addEventListener('click', () => {
  alarmAudio.pause();
  alarmPopup.classList.add('hidden');
  // block this exact minute for the same trigger (already set in triggered map)
  // nothing else to do
  currentAlarm = null;
});

// Snooze 5 minutes
snoozeBtn.addEventListener('click', () => {
  if(!currentAlarm) return;
  alarmAudio.pause();
  alarmPopup.classList.add('hidden');

  // compute snooze minute key, and ensure we set triggered map so normal check won't retrigger until snooze ends
  const snoozeAt = new Date();
  snoozeAt.setMinutes(snoozeAt.getMinutes() + 5);
  snoozeAt.setSeconds(0,0);
  const snoozeKey = snoozeAt.toISOString();

  const tk = currentAlarm.task.id + '-' + (currentAlarm.when === 'Start' ? 'start' : 'end');
  // set the future key in triggered map so when the time reaches snoozeAt minuteKey it'll be different and will retrigger
  // to implement snooze we instead set a block until snooze minute, and then we will allow retrigger at that minute
  // here we'll set a temp blocker: set a timestamp to block until snoozeAt
  // simplest: store a custom snooze map
  if(!window.snoozes) window.snoozes = {};
  window.snoozes[tk] = snoozeAt.getTime();

  currentAlarm = null;
});

// integrate snoozes into check: modify checkAlarms to consider snoozes
// (redefine checkAlarms with snooze handling)
function checkAlarms(){
  if(!tasks || tasks.length===0) return;
  const current = nowHHMM();
  const minuteKey = nowKeyMinute();

  tasks.forEach(t=>{
    ['start','end'].forEach(type=>{
      const timeVal = type === 'start' ? t.start : t.end;
      const key = `${t.id}-${type}`;

      // snooze check
      if(window.snoozes && window.snoozes[key]){
        if(Date.now() < window.snoozes[key]){
          // still snoozed: skip
          return;
        } else {
          // snooze expired: remove so next matching minute triggers
          delete window.snoozes[key];
        }
      }

      if(timeVal === current){
        if(triggered[key] !== minuteKey){
          triggered[key] = minuteKey;
          showAlarm(t, type === 'start' ? 'Start' : 'End');
        }
      }
    });
  });
}

// Make sure tasks are reloaded if user returns after editing
window.addEventListener('storage', (e)=>{
  if(e.key === 'planova-tasks'){
    tasks = JSON.parse(localStorage.getItem('planova-tasks') || '[]');
    tasks.sort((a,b)=> a.start > b.start ? 1:-1);
    renderTimeline();
  }
});