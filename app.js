// ── State ──────────────────────────────────────────────────────────────────
let todos = JSON.parse(localStorage.getItem('todos') || '[]');
let currentFilter = 'all';
let editingId = null;
let tempSubtasks = [];

// ── Helpers ────────────────────────────────────────────────────────────────
const save = () => localStorage.setItem('todos', JSON.stringify(todos));
const uid  = () => Date.now().toString(36) + Math.random().toString(36).slice(2);
const today = () => new Date().toISOString().slice(0, 10);

function dueStatus(todo) {
  if (!todo.due) return null;
  const d = todo.due;
  const t = today();
  if (d < t) return 'overdue';
  if (d === t) return 'today';
  return 'upcoming';
}

function priorityOrder(p) {
  return { urgent: 0, high: 1, medium: 2, low: 3 }[p] ?? 2;
}

// ── Filtering & Sorting ────────────────────────────────────────────────────
function getFiltered() {
  const search = document.getElementById('search-input').value.trim().toLowerCase();
  const sort   = document.getElementById('sort-select').value;

  let list = todos.filter(t => {
    if (search && !t.title.toLowerCase().includes(search) &&
        !(t.desc || '').toLowerCase().includes(search) &&
        !(t.tags || []).some(g => g.includes(search))) return false;
    if (currentFilter === 'done')     return t.done;
    if (currentFilter === 'today')    return !t.done && dueStatus(t) === 'today';
    if (currentFilter === 'upcoming') return !t.done && dueStatus(t) === 'upcoming';
    if (currentFilter === 'overdue')  return !t.done && dueStatus(t) === 'overdue';
    if (currentFilter.startsWith('cat:')) return (t.category || '').toLowerCase() === currentFilter.slice(4);
    return true; // all
  });

  list = [...list].sort((a, b) => {
    if (sort === 'priority') return priorityOrder(a.priority) - priorityOrder(b.priority);
    if (sort === 'due') {
      if (!a.due && !b.due) return 0;
      if (!a.due) return 1;
      if (!b.due) return -1;
      return a.due.localeCompare(b.due);
    }
    if (sort === 'alpha') return a.title.localeCompare(b.title);
    return b.createdAt - a.createdAt; // created
  });

  return list;
}

// ── Render ─────────────────────────────────────────────────────────────────
function render() {
  renderSidebar();
  renderTasks();
}

function renderSidebar() {
  const all      = todos;
  const active   = todos.filter(t => !t.done);
  const todayArr = active.filter(t => dueStatus(t) === 'today');
  const upcoming = active.filter(t => dueStatus(t) === 'upcoming');
  const overdue  = active.filter(t => dueStatus(t) === 'overdue');
  const done     = todos.filter(t => t.done);

  setBadge('badge-all',      all.length);
  setBadge('badge-today',    todayArr.length);
  setBadge('badge-upcoming', upcoming.length);
  setBadge('badge-overdue',  overdue.length);
  setBadge('badge-done',     done.length);

  document.getElementById('stat-total').textContent  = todos.length;
  document.getElementById('stat-done').textContent   = done.length;
  document.getElementById('stat-overdue').textContent = overdue.length;

  // Categories
  const cats = [...new Set(todos.map(t => t.category).filter(Boolean))];
  const nav = document.getElementById('category-nav');
  nav.innerHTML = cats.map(c => {
    const key = 'cat:' + c.toLowerCase();
    const cnt = todos.filter(t => (t.category || '').toLowerCase() === c.toLowerCase()).length;
    return `<button class="nav-btn ${currentFilter === key ? 'active' : ''}" data-filter="${key}">
      <i class="fa-solid fa-tag"></i> ${c} <span class="badge">${cnt}</span>
    </button>`;
  }).join('');
  nav.querySelectorAll('.nav-btn').forEach(b => b.addEventListener('click', onFilterClick));

  // Datalist
  const dl = document.getElementById('cat-list');
  dl.innerHTML = cats.map(c => `<option value="${c}">`).join('');
}

function setBadge(id, n) {
  const el = document.getElementById(id);
  if (el) el.textContent = n || '';
}

function renderTasks() {
  const list  = getFiltered();
  const el    = document.getElementById('task-list');
  const empty = document.getElementById('empty-state');

  el.innerHTML = '';
  if (!list.length) { empty.style.display = 'flex'; return; }
  empty.style.display = 'none';

  list.forEach(todo => {
    const ds    = dueStatus(todo);
    const doneTotal = (todo.subtasks || []).filter(s => s.done).length;
    const subTotal  = (todo.subtasks || []).length;

    const card = document.createElement('div');
    card.className = `task-card priority-${todo.priority || 'medium'} ${todo.done ? 'done' : ''} ${ds === 'overdue' && !todo.done ? 'overdue' : ''}`;
    card.dataset.id = todo.id;

    card.innerHTML = `
      <div class="task-left">
        <button class="check-btn ${todo.done ? 'checked' : ''}" data-id="${todo.id}">
          <i class="fa-${todo.done ? 'solid' : 'regular'} fa-circle-check"></i>
        </button>
      </div>
      <div class="task-body">
        <div class="task-top">
          <span class="task-title">${escHtml(todo.title)}</span>
          <span class="priority-badge p-${todo.priority || 'medium'}">${todo.priority || 'medium'}</span>
        </div>
        ${todo.desc ? `<p class="task-desc">${escHtml(todo.desc)}</p>` : ''}
        <div class="task-meta">
          ${todo.category ? `<span class="meta-chip cat-chip"><i class="fa-solid fa-tag"></i> ${escHtml(todo.category)}</span>` : ''}
          ${todo.due ? `<span class="meta-chip due-chip ${ds === 'overdue' && !todo.done ? 'due-overdue' : ds === 'today' ? 'due-today' : ''}"><i class="fa-solid fa-calendar-day"></i> ${formatDue(todo.due, todo.time)}</span>` : ''}
          ${(todo.tags || []).map(tag => `<span class="meta-chip tag-chip">#${escHtml(tag)}</span>`).join('')}
          ${subTotal ? `<span class="meta-chip sub-chip"><i class="fa-solid fa-list-ul"></i> ${doneTotal}/${subTotal}</span>` : ''}
          <span class="meta-chip created-chip"><i class="fa-regular fa-clock"></i> ${formatCreated(todo.createdAt)}</span>
        </div>
        ${subTotal ? `<div class="subtask-progress"><div class="subtask-bar" style="width:${Math.round(doneTotal/subTotal*100)}%"></div></div>` : ''}
        ${subTotal ? `<ul class="subtask-mini">${(todo.subtasks || []).map((s, si) =>
          `<li class="${s.done ? 'done' : ''}">
            <input type="checkbox" ${s.done ? 'checked' : ''} data-pid="${todo.id}" data-si="${si}" />
            <span>${escHtml(s.text)}</span>
          </li>`).join('')}</ul>` : ''}
      </div>
      <div class="task-actions">
        <button class="action-btn edit-btn" data-id="${todo.id}" title="Edit"><i class="fa-solid fa-pen"></i></button>
        <button class="action-btn del-btn" data-id="${todo.id}" title="Delete"><i class="fa-solid fa-trash"></i></button>
      </div>`;

    el.appendChild(card);
  });

  // Events
  el.querySelectorAll('.check-btn').forEach(b => b.addEventListener('click', () => toggleDone(b.dataset.id)));
  el.querySelectorAll('.edit-btn').forEach(b => b.addEventListener('click', () => openEdit(b.dataset.id)));
  el.querySelectorAll('.del-btn').forEach(b => b.addEventListener('click', () => deleteTask(b.dataset.id)));
  el.querySelectorAll('.subtask-mini input').forEach(cb => cb.addEventListener('change', e => {
    toggleSubtask(e.target.dataset.pid, +e.target.dataset.si, e.target.checked);
  }));
}

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function formatDue(date, time) {
  const d = new Date(date + 'T00:00:00');
  const str = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  return time ? str + ' ' + time : str;
}

function formatCreated(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ── Actions ────────────────────────────────────────────────────────────────
function toggleDone(id) {
  const t = todos.find(t => t.id === id);
  if (!t) return;
  t.done = !t.done;
  if (t.done) t.completedAt = Date.now();
  else delete t.completedAt;
  save(); render();
}

function deleteTask(id) {
  todos = todos.filter(t => t.id !== id);
  save(); render();
}

function toggleSubtask(pid, si, val) {
  const t = todos.find(t => t.id === pid);
  if (!t || !t.subtasks[si]) return;
  t.subtasks[si].done = val;
  save(); render();
}

// ── Modal ──────────────────────────────────────────────────────────────────
const overlay = document.getElementById('modal-overlay');

function openModal() {
  editingId = null;
  tempSubtasks = [];
  document.getElementById('modal-title').textContent = 'New Task';
  clearForm();
  renderSubtaskList();
  overlay.classList.add('open');
  document.getElementById('f-title').focus();
}

function openEdit(id) {
  const t = todos.find(t => t.id === id);
  if (!t) return;
  editingId = id;
  tempSubtasks = [...(t.subtasks || []).map(s => ({ ...s }))];
  document.getElementById('modal-title').textContent = 'Edit Task';
  document.getElementById('f-title').value    = t.title;
  document.getElementById('f-desc').value     = t.desc || '';
  document.getElementById('f-due').value      = t.due || '';
  document.getElementById('f-time').value     = t.time || '';
  document.getElementById('f-priority').value = t.priority || 'medium';
  document.getElementById('f-category').value = t.category || '';
  document.getElementById('f-tags').value     = (t.tags || []).join(', ');
  renderSubtaskList();
  overlay.classList.add('open');
}

function closeModal() {
  overlay.classList.remove('open');
  editingId = null;
  tempSubtasks = [];
}

function clearForm() {
  ['f-title','f-desc','f-due','f-time','f-category','f-tags','f-subtask-input'].forEach(id => {
    document.getElementById(id).value = '';
  });
  document.getElementById('f-priority').value = 'medium';
}

function saveTask() {
  const title = document.getElementById('f-title').value.trim();
  if (!title) { document.getElementById('f-title').focus(); return; }

  const tags = document.getElementById('f-tags').value.split(',').map(s => s.trim()).filter(Boolean);

  if (editingId) {
    const t = todos.find(t => t.id === editingId);
    t.title    = title;
    t.desc     = document.getElementById('f-desc').value.trim();
    t.due      = document.getElementById('f-due').value;
    t.time     = document.getElementById('f-time').value;
    t.priority = document.getElementById('f-priority').value;
    t.category = document.getElementById('f-category').value.trim();
    t.tags     = tags;
    t.subtasks = tempSubtasks;
  } else {
    todos.unshift({
      id: uid(),
      title,
      desc:      document.getElementById('f-desc').value.trim(),
      due:       document.getElementById('f-due').value,
      time:      document.getElementById('f-time').value,
      priority:  document.getElementById('f-priority').value,
      category:  document.getElementById('f-category').value.trim(),
      tags,
      subtasks:  tempSubtasks,
      done:      false,
      createdAt: Date.now(),
    });
  }
  save(); closeModal(); render();
}

// Subtasks in modal
function renderSubtaskList() {
  const ul = document.getElementById('subtask-list');
  ul.innerHTML = tempSubtasks.map((s, i) => `
    <div class="subtask-row">
      <input type="checkbox" ${s.done ? 'checked' : ''} data-si="${i}" class="st-check" />
      <span>${escHtml(s.text)}</span>
      <button type="button" class="st-del" data-si="${i}"><i class="fa-solid fa-xmark"></i></button>
    </div>`).join('');
  ul.querySelectorAll('.st-check').forEach(cb => cb.addEventListener('change', e => {
    tempSubtasks[+e.target.dataset.si].done = e.target.checked;
    renderSubtaskList();
  }));
  ul.querySelectorAll('.st-del').forEach(b => b.addEventListener('click', e => {
    tempSubtasks.splice(+e.currentTarget.dataset.si, 1);
    renderSubtaskList();
  }));
}

function addSubtask() {
  const inp = document.getElementById('f-subtask-input');
  const text = inp.value.trim();
  if (!text) return;
  tempSubtasks.push({ text, done: false });
  inp.value = '';
  renderSubtaskList();
}

// ── Filter nav ─────────────────────────────────────────────────────────────
function onFilterClick(e) {
  const btn = e.currentTarget;
  currentFilter = btn.dataset.filter;
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const titles = { all: 'All Tasks', today: 'Today', upcoming: 'Upcoming', overdue: 'Overdue', done: 'Completed' };
  document.getElementById('view-title').textContent =
    titles[currentFilter] || currentFilter.slice(4);
  render();
}

// ── Event listeners ────────────────────────────────────────────────────────
document.getElementById('open-modal-btn').addEventListener('click', openModal);
document.getElementById('modal-close').addEventListener('click', closeModal);
document.getElementById('modal-cancel').addEventListener('click', closeModal);
document.getElementById('modal-save').addEventListener('click', saveTask);
document.getElementById('f-subtask-btn').addEventListener('click', addSubtask);
document.getElementById('f-subtask-input').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); addSubtask(); }});
document.getElementById('search-input').addEventListener('input', renderTasks);
document.getElementById('sort-select').addEventListener('change', renderTasks);
overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });
document.querySelectorAll('.nav-btn[data-filter]').forEach(b => b.addEventListener('click', onFilterClick));
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

// ── Init ───────────────────────────────────────────────────────────────────
render();
