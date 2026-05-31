import './styles/navigator.css';
import { NGS_DATA } from '../scholars-data.js';

const D = NGS_DATA;

const $ = (s, r) => (r || document).querySelector(s);

if (!D || !D.config) {
  console.error('[NGS] scholars-data.js did not load — NGS_DATA is undefined.');
  const sub = document.querySelector('#lock .lock-sub');
  if (sub) { sub.textContent = 'Data failed to load — hard-refresh (Ctrl/Cmd+Shift+R)'; sub.style.color = '#E4977A'; }
  throw new Error('NGS_DATA missing');
}

const el = (tag, cls, html) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (html != null) n.innerHTML = html;
  return n;
};
const esc = s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const SCHOLAR_KEYS = ['claire', 'april', 'aljane'];
const NAMECLASS = { Claire: '', April: 't-april', Aljane: 't-aljane' };

const state = {
  currency: 'PHP',
  expScholar: 'claire',
  expView: 'sem',
  expSearch: '',
  expSem: 'all',
  logs: [],
  checked: {},
  liveGpa: {},
};

function fmt(amount) {
  if (amount == null) return '—';
  if (state.currency === 'USD') {
    const usd = Math.round(amount / D.config.exchangeRate);
    return '$' + usd.toLocaleString('en-US');
  }
  return '₱' + Math.round(amount).toLocaleString('en-US');
}

function gpaClass(gpa, floor) {
  if (gpa == null) return '';
  if (gpa >= floor + 2) return 'g-green';
  if (gpa >= floor) return 'g-amber';
  return 'g-red';
}

function latestGpa(s) {
  const key = s._key;
  if (state.liveGpa[key] != null) return state.liveGpa[key];
  const closed = (s.academics || []).filter(a => a.gpa != null);
  return closed.length ? closed[closed.length - 1].gpa : null;
}

function allExpenses(s) {
  const out = [];
  Object.keys(s.expenses).forEach(sem => s.expenses[sem].forEach(e => out.push(Object.assign({ sem, status: e.avb }, e))));
  return out;
}

function sumActual(s) {
  return allExpenses(s).reduce((t, e) => t + (e.avb === 'Actual' ? (e.amount || 0) : 0), 0);
}

function sumMilestones(s) {
  return (s.milestones || []).reduce((t, m) => t + (m.state === 'done' ? (m.amountPhp || 0) : 0), 0);
}

function sumTravel(s) {
  return (s.travels || []).reduce((t, v) => t + (v.state === 'done' ? (v.amountPhp || 0) : 0), 0);
}

function sumAllocated(s) {
  return Object.values(s.budgets || {}).reduce((t, v) => t + (typeof v === 'number' ? v : 0), 0);
}

function scholarTotals(s) {
  const university = sumActual(s);
  const milestones = sumMilestones(s);
  const travel = sumTravel(s);
  return { university, milestones, travel, total: university + milestones + travel, allocated: sumAllocated(s) };
}

function nextMilestone(s) {
  const f = (s.milestones || []).find(m => m.state !== 'done');
  if (!f) return { name: 'All milestones complete', detail: '—' };
  return { name: f.name, detail: f.sem ? ('Expected · ' + f.sem) : 'Upcoming' };
}

function accentFor(s) {
  return s.status === 'active' ? 'gold' : s.status === 'trial' ? 'navy' : 'muted';
}

function renderAlerts() {
  const list = $('#alertList');
  list.innerHTML = '';
  const live = D.alerts.filter(a => !a._dismissed);
  if (!live.length) {
    list.appendChild(el('div', 'alert-empty', '<span class="check">✓</span>All clear — no open escalations.'));
    return;
  }
  live.forEach(a => {
    const node = el('div', 'alert ' + a.severity);
    node.dataset.id = a.id;
    node.innerHTML =
      '<div class="alert-icon">' + esc(a.icon) + '</div>' +
      '<div class="alert-body"><div class="alert-title">' + esc(a.title) + '</div>' +
      '<div class="alert-sub">' + esc(a.sub) + '</div></div>' +
      '<div class="alert-meta"><span class="scholar-tag ' + esc(NAMECLASS[a.scholar] || '') + '">' + esc(a.scholar) + '</span>' +
      '<button class="alert-x" aria-label="Dismiss">×</button></div>';
    node.querySelector('.alert-x').addEventListener('click', () => {
      node.classList.add('dismissing');
      setTimeout(() => { a._dismissed = true; renderAlerts(); }, 400);
    });
    list.appendChild(node);
  });
}

function renderStatus() {
  const grid = $('#statusGrid');
  grid.innerHTML = '';
  SCHOLAR_KEYS.forEach(k => {
    const s = D.scholars[k]; s._key = k;
    const gpa = latestGpa(s);
    const tot = scholarTotals(s);
    const budgetPct = tot.allocated ? Math.min(100, Math.round(tot.total / tot.allocated * 100)) : 0;
    const next = nextMilestone(s);
    const pillCls = s.status === 'active' ? 'active' : s.status === 'trial' ? 'trial' : 'paused';
    const pillTxt = s.status === 'active' ? 'Active' : s.status === 'trial' ? 'Trial' : 'Paused';
    const card = el('article', 'scard accent-' + accentFor(s));
    card.dataset.scholar = k;
    card.innerHTML =
      '<div class="scard-body">' +
        '<div class="scard-head"><div><div class="scard-name">' + esc(s.firstName) + '</div></div>' +
        '<span class="pill ' + esc(pillCls) + '">' + esc(pillTxt) + '</span></div>' +
        '<div class="scard-school">' + esc(s.school) + '</div>' +
        '<div class="metric-grid">' +
          '<div class="metric"><div class="metric-val">' + esc(s.currentSem || '—') + '</div><div class="metric-lbl">Current<br>Sem</div></div>' +
          '<div class="metric"><div class="metric-val ' + esc(gpaClass(gpa, s.gpaFloor)) + '" data-gpa-cell>' + esc(gpa != null ? gpa.toFixed(2) + '%' : '—') + '</div><div class="metric-lbl">Last<br>GPA</div></div>' +
          '<div class="metric"><div class="metric-val" data-amt="' + esc(tot.total) + '">' + esc(fmt(tot.total)) + '</div><div class="metric-lbl">Total<br>Invested</div></div>' +
          '<div class="metric"><div class="metric-val">' + esc(budgetPct) + '%</div><div class="metric-lbl">Budget<br>Used</div></div>' +
        '</div>' +
        '<div class="scard-prog"><div class="scard-prog-fill" style="width:0%"></div></div>' +
        '<div class="scard-prog-lbl">' + esc(s.gpaFloor != null ? 'Floor ' + s.gpaFloor + '% · ' : '') + esc(budgetPct) + '% of allocation deployed</div>' +
        '<div class="scard-next"><div class="scard-next-lbl">Next milestone</div>' +
        '<div class="scard-next-name">' + esc(next.name) + '</div>' +
        '<div class="scard-next-detail">' + esc(next.detail) + '</div></div>' +
      '</div>';
    grid.appendChild(card);
    requestAnimationFrame(() => { card.querySelector('.scard-prog-fill').style.width = budgetPct + '%'; });
  });
}

function initLog() {
  const sel = $('#logScholar');
  SCHOLAR_KEYS.forEach(k => {
    const o = el('option'); o.value = k; o.textContent = D.scholars[k].firstName; sel.appendChild(o);
  });
  $('#logForm').addEventListener('submit', e => {
    e.preventDefault();
    const key = sel.value;
    const type = $('#logType').value;
    const detail = $('#logDetail').value.trim();
    if (!detail) return;
    const s = D.scholars[key];
    const now = new Date();
    const ts = now.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
    state.logs.unshift({ ts, scholar: s.firstName, type, detail });

    if (type === 'GPA') {
      const m = detail.match(/(\d{1,3}(?:\.\d+)?)/);
      if (m) {
        const val = parseFloat(m[1]);
        state.liveGpa[key] = val;
        renderStatus();
        if (val < s.gpaFloor) {
          D.alerts.unshift({
            id: 'gpa-' + Date.now(), severity: 'critical', icon: '🔴', scholar: s.firstName,
            title: 'GPA below floor — ' + s.firstName,
            sub: 'Logged ' + val.toFixed(2) + '% against a ' + s.gpaFloor + '% floor. Intervention required.',
          });
          renderAlerts();
        }
      }
    }
    $('#logDetail').value = '';
    renderLogFeed();
  });
  renderLogFeed();
}

function renderLogFeed() {
  const feed = $('#logFeed');
  feed.innerHTML = '';
  if (!state.logs.length) {
    feed.appendChild(el('div', 'log-empty', 'No updates logged this session.'));
    return;
  }
  state.logs.slice(0, 5).forEach(l => {
    const row = el('div', 'log-row');
    const time = el('span', 'log-time'); time.textContent = l.ts;
    const tag = el('span', 'scholar-tag ' + (NAMECLASS[l.scholar] || '')); tag.textContent = l.scholar;
    const type = el('span', 'log-type'); type.textContent = l.type;
    const detail = el('span', 'log-detail'); detail.textContent = l.detail;
    row.append(time, tag, type, detail);
    feed.appendChild(row);
  });
}

function initExpense() {
  const tabs = $('#expTabs');
  SCHOLAR_KEYS.forEach(k => {
    const b = el('button', 'tab' + (k === state.expScholar ? ' active' : ''));
    b.textContent = D.scholars[k].firstName;
    b.dataset.scholar = k;
    b.addEventListener('click', () => {
      state.expScholar = k; state.expSem = 'all'; state.expSearch = '';
      $('#expSearch').value = '';
      [...tabs.children].forEach(c => c.classList.toggle('active', c.dataset.scholar === k));
      renderExpense();
    });
    tabs.appendChild(b);
  });
  $('#expView').addEventListener('click', e => {
    const btn = e.target.closest('button'); if (!btn) return;
    state.expView = btn.dataset.view;
    [...$('#expView').children].forEach(c => c.classList.toggle('active', c.dataset.view === state.expView));
    renderChart();
  });
  $('#expSearch').addEventListener('input', e => { state.expSearch = e.target.value.toLowerCase(); renderExpTable(); });
  $('#expSem').addEventListener('change', e => { state.expSem = e.target.value; renderExpTable(); });
  renderExpense();
}

function renderExpense() { renderTotals(); renderChart(); renderSemDropdown(); renderExpTable(); }

function renderTotals() {
  const s = D.scholars[state.expScholar];
  const b = scholarTotals(s);
  const row = $('#totalsRow');
  row.innerHTML =
    '<div class="total-card lead"><div class="total-val" data-amt="' + esc(b.total) + '">' + esc(fmt(b.total)) + '</div><div class="total-lbl">Total Invested</div></div>' +
    '<div class="total-card"><div class="total-val" data-amt="' + esc(b.university) + '">' + esc(fmt(b.university)) + '</div><div class="total-lbl">Universidad</div></div>' +
    '<div class="total-card"><div class="total-val" data-amt="' + esc(b.milestones) + '">' + esc(fmt(b.milestones)) + '</div><div class="total-lbl">Milestones</div></div>' +
    '<div class="total-card"><div class="total-val" data-amt="' + esc(b.travel) + '">' + esc(fmt(b.travel)) + '</div><div class="total-lbl">Viajes</div></div>';
}

function renderChart() {
  const card = $('#chartCard');
  const s = D.scholars[state.expScholar];
  if (state.expView === 'sem') {
    const sems = Object.keys(s.expenses);
    const data = sems.map(sem => {
      let actual = 0, budget = 0;
      s.expenses[sem].forEach(e => { if (e.avb === 'Actual') actual += e.amount; else budget += e.amount; });
      return { sem, actual, budget };
    });
    const max = Math.max(1, ...data.flatMap(d => [d.actual, d.budget]));
    let bars = '<div class="bars">';
    data.forEach(d => {
      const ah = Math.round(d.actual / max * 100);
      const bh = Math.round(d.budget / max * 100);
      bars += '<div class="bar-group"><div class="bar-pair">' +
        '<div class="bar actual" style="height:' + esc(ah) + '%"><span class="bar-tip">' + esc(fmt(d.actual)) + '</span></div>' +
        '<div class="bar budget" style="height:' + esc(bh) + '%"><span class="bar-tip">' + esc(fmt(d.budget)) + '</span></div>' +
        '</div></div>';
    });
    bars += '</div><div class="bar-xlabels">' + data.map(d => '<div class="bar-xlabel">' + esc(d.sem) + '</div>').join('') + '</div>';
    bars += '<div class="legend"><div class="legend-item"><span class="legend-swatch actual"></span>Actual spend</div>' +
      '<div class="legend-item"><span class="legend-swatch budget"></span>Budgeted / projected</div></div>';
    card.innerHTML = bars;
    const barEls = card.querySelectorAll('.bar');
    barEls.forEach(b => { const h = b.style.height; b.style.height = '0%'; requestAnimationFrame(() => requestAnimationFrame(() => b.style.height = h)); });
  } else {
    const totals = {};
    allExpenses(s).forEach(e => { totals[e.cat] = (totals[e.cat] || 0) + e.amount; });
    const entries = Object.entries(totals).sort((a, b) => b[1] - a[1]);
    const max = Math.max(1, ...entries.map(e => e[1]));
    let rows = '<div class="cat-rows">';
    entries.forEach(([cat, val]) => {
      rows += '<div class="cat-row"><div class="cat-label">' + esc(cat) + '</div>' +
        '<div class="cat-track"><div class="cat-fill" data-w="' + esc(val / max * 100) + '"></div></div>' +
        '<div class="cat-val" data-amt="' + esc(val) + '">' + esc(fmt(val)) + '</div></div>';
    });
    rows += '</div>';
    card.innerHTML = rows;
    requestAnimationFrame(() => card.querySelectorAll('.cat-fill').forEach(f => { f.style.width = f.dataset.w + '%'; }));
  }
}

function renderSemDropdown() {
  const s = D.scholars[state.expScholar];
  const sel = $('#expSem');
  sel.innerHTML = '<option value="all">All semesters</option>' +
    Object.keys(s.expenses).map(sem => '<option value="' + esc(sem) + '">' + esc(sem) + '</option>').join('');
  sel.value = state.expSem;
}

function renderExpTable() {
  const s = D.scholars[state.expScholar];
  const body = $('#expBody');
  let rows = allExpenses(s);
  if (state.expSem !== 'all') rows = rows.filter(r => r.sem === state.expSem);
  if (state.expSearch) rows = rows.filter(r => (r.item + ' ' + r.cat).toLowerCase().includes(state.expSearch));
  rows = rows.slice(0, 60);
  body.innerHTML = '';
  if (!rows.length) {
    body.innerHTML = '<tr class="exp-none"><td colspan="5">No matching expenses.</td></tr>';
    return;
  }
  rows.forEach(r => {
    const tr = el('tr');
    tr.innerHTML =
      '<td><span class="exp-item">' + esc(r.item) + '</span></td>' +
      '<td><span class="exp-cat">' + esc(r.cat) + '</span></td>' +
      '<td class="exp-date">' + esc(r.date) + '</td>' +
      '<td class="right exp-amount" data-amt="' + esc(r.amount) + '">' + esc(fmt(r.amount)) + '</td>' +
      '<td><span class="exp-status ' + esc(r.status) + '">' + esc(r.status) + '</span></td>';
    body.appendChild(tr);
  });
}

function renderDeadlines() {
  const body = $('#dlBody');
  body.innerHTML = '';
  [...D.deadlines].sort((a, b) => a.sort - b.sort).forEach(d => {
    const tr = el('tr');
    tr.innerHTML =
      '<td><span class="dl-event">' + esc(d.event) + '</span></td>' +
      '<td><span class="scholar-tag ' + esc(NAMECLASS[d.scholar] || '') + '">' + esc(d.scholar) + '</span></td>' +
      '<td class="dl-when">' + esc(d.when) + '</td>' +
      '<td class="dl-cat">' + esc(d.cat) + '</td>' +
      '<td><span class="urg ' + esc(d.urgency) + '">' + esc(d.urgency) + '</span></td>';
    body.appendChild(tr);
  });
}

function renderActions() {
  const list = $('#actionsList');
  list.innerHTML = '';
  D.actions.forEach(a => {
    const done = !!state.checked[a.id];
    const item = el('div', 'action' + (done ? ' done' : ''));
    item.innerHTML =
      '<span class="checkbox">✓</span>' +
      '<span class="action-text">' + esc(a.text) + '</span>' +
      '<span class="scholar-tag ' + esc(NAMECLASS[a.scholar] || '') + '">' + esc(a.scholar) + '</span>' +
      '<span class="action-cat">' + esc(a.cat) + '</span>';
    item.addEventListener('click', () => { state.checked[a.id] = !state.checked[a.id]; renderActions(); });
    list.appendChild(item);
  });
  const left = D.actions.length - Object.values(state.checked).filter(Boolean).length;
  $('#actionCount').textContent = left + ' of ' + D.actions.length + ' open';
}

function reformatAmounts() {
  document.querySelectorAll('[data-amt]').forEach(n => { n.textContent = fmt(parseFloat(n.dataset.amt)); });
}

function initCurrency() {
  $('#currencyToggle').addEventListener('click', e => {
    const btn = e.target.closest('button'); if (!btn) return;
    state.currency = btn.dataset.cur;
    [...$('#currencyToggle').children].forEach(c => c.classList.toggle('active', c.dataset.cur === state.currency));
    reformatAmounts();
  });
}

function initLock() {
  const form = $('#lockForm'), input = $('#lockInput'), err = $('#lockErr');
  form.addEventListener('submit', e => {
    e.preventDefault();
    if (input.value === D.config.password) {
      $('#lock').classList.add('is-hidden');
      document.body.style.overflow = '';
    } else {
      form.classList.remove('is-error'); void form.offsetWidth;
      form.classList.add('is-error'); err.classList.add('show');
      input.select();
    }
  });
  input.addEventListener('input', () => { form.classList.remove('is-error'); err.classList.remove('show'); });
  setTimeout(() => input.focus(), 400);
}

$('#footUpdated').textContent = 'Last updated · ' + D.config.lastUpdated;
SCHOLAR_KEYS.forEach(k => { D.scholars[k]._key = k; });
initLock();
initCurrency();
renderAlerts();
renderStatus();
initLog();
initExpense();
renderDeadlines();
renderActions();
