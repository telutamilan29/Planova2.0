// Planova main JS (index.html)
const taskForm = document.getElementById('taskForm');
const taskName = document.getElementById('taskName');
const startTime = document.getElementById('startTime');
const endTime = document.getElementById('endTime');
const taskList = document.getElementById('taskList');
const emptyHint = document.getElementById('emptyHint');
const clearAll = document.getElementById('clearAll');
const audio = document.getElementById('alarmAudio');
const themeToggle = document.getElementById('themeToggle');

let tasks = JSON.parse(localStorage.getItem('planova-tasks') || '[]');
let editingId = null;

function saveTasks(){
  localStorage.setItem('planova-tasks', JSON.stringify(tasks));
  renderTasks();
}

function renderTasks(){
  taskList.innerHTML = '';
  if(!tasks || tasks.length === 0){
    emptyHint.style.display = 'block';
    return;
  }
  emptyHint.style.display = 'none';
  // render in insertion order (user can sort on chart page)
  tasks.forEach(t => {
    const li = document.createElement('li');
    li.className = 'task-item';
    li.innerHTML = `
      <div class="task-meta">
        <div>
          <div style="font-weight:700">${escapeHtml(t.name)}</div>
          <div class="small">${t.start} → ${t.end}</div>
        </div>
      </div>
      <div class="item-actions">
        <button class="icon" data-edit="${t.id}" title="Edit">✏️</button>
        <button class="icon" data-del="${t.id}" title="Delete">🗑️</button>
      </div>
    `;
    taskList.appendChild(li);
  });
}

// simple escape to avoid injection if a user pastes weird stuff
function escapeHtml(s){
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

taskList.addEventListener('click', (e) => {
  const editId = e.target.getAttribute('data-edit');
  const delId = e.target.getAttribute('data-del');
  if(editId){
    const t = tasks.find(x=>x.id==editId);
    if(t){
      editingId = t.id;
      taskName.value = t.name;
      startTime.value = t.start;
      endTime.value = t.end;
    }
  } else if(delId){
    tasks = tasks.filter(x=>x.id!=delId);
    saveTasks();
  }
});

taskForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const name = taskName.value.trim();
  const start = startTime.value;
  const end = endTime.value;

  if(!name || !start || !end){
    alert('Fill all fields bro');
    return;
  }
  // basic validation: end should not be before start (optional)
  if(end <= start){
    const ok = confirm('End time is same or before start. Continue?');
    if(!ok) return;
  }

  if(editingId){
    const idx = tasks.findIndex(x=>x.id==editingId);
    if(idx>-1){
      tasks[idx].name = name;
      tasks[idx].start = start;
      tasks[idx].end = end;
    }
    editingId = null;
  } else {
    const id = Date.now().toString(36) + Math.floor(Math.random()*1000);
    tasks.push({ id, name, start, end });
  }
  taskForm.reset();
  saveTasks();
});

clearAll.addEventListener('click', () => {
  if(confirm('Clear all tasks?')) {
    tasks = [];
    saveTasks();
  }
});

// load initial
renderTasks();

// Theme toggle (sync with welcome page)
function applyTheme(t){
  document.documentElement.setAttribute('data-theme', t);
  localStorage.setItem('planova-theme', t);
  themeToggle.textContent = t === 'dark' ? '🌞' : '🌗';
}
const saved = localStorage.getItem('planova-theme') || 'light';
applyTheme(saved);
themeToggle.addEventListener('click', () => {
  const cur = document.documentElement.getAttribute('data-theme') || 'light';
  applyTheme(cur === 'dark' ? 'light' : 'dark');
});


// Note: alarm checking is performed on chart page where timing & notification UI exist.
// But in case user opens planner and time triggers, we offer a small check to play briefly:
setInterval(() => {
  // This is passive — we don't bombard planner page users.
  // (Chart page handles full alarm UI.)
}, 30000);

// -------------------- ALARM SYSTEM --------------------
let alarmSound = new Audio("bird.mp3");
alarmSound.loop = false;

function showAlarmPopup(text) {
  document.getElementById("alarmTitle").innerText = text;
  document.getElementById("alarmPopup").classList.remove("hidden");
  alarmSound.play();
}

document.getElementById("dismissAlarm").onclick = () => {
  alarmSound.pause();
  alarmSound.currentTime = 0;
  document.getElementById("alarmPopup").classList.add("hidden");
};

// Prevent double alarms
let alarmTriggered = {};

// Main Alarm Checker
setInterval(() => {
  let now = new Date();
  let currentTime = now.toTimeString().slice(0,5); // HH:MM

  let tasks = JSON.parse(localStorage.getItem("tasks")) || [];

  tasks.forEach(task => {
    // Start alarm
    if (task.start === currentTime && !alarmTriggered[task.id + "_start"]) {
      alarmTriggered[task.id + "_start"] = true;
      showAlarmPopup(`${task.name} time started!`);
    }

    // End alarm
    if (task.end === currentTime && !alarmTriggered[task.id + "_end"]) {
      alarmTriggered[task.id + "_end"] = true;
      showAlarmPopup(`${task.name} time ended!`);
    }
  });
}, 10000); // Checks every 10 seconds

// ----- ALARM SYSTEM (runs on both pages) -----
function checkAlarms() {
  const now = new Date();
  const current = now.toTimeString().slice(0,5); // HH:MM

  let tasks = JSON.parse(localStorage.getItem('planova-tasks') || '[]');

  tasks.forEach(t => {
    if (t.start === current || t.end === current) {
      showAlarm(t);
    }
  });
}

function showAlarm(task) {
  const popup = document.getElementById('alarmPopup');
  const msg = document.getElementById('alarmMsg');
  const dismiss = document.getElementById('dismissAlarm');
  const audio = document.getElementById('alarmAudio');

  msg.textContent = `⏰ ${task.name} — Time reached!`;
  popup.classList.remove('hidden');

  audio.currentTime = 0;
  audio.play();

  dismiss.onclick = () => {
    popup.classList.add('hidden');
    audio.pause();
  };
}

// check every 30 seconds
setInterval(checkAlarms, 30000);

// run once on load
checkAlarms();