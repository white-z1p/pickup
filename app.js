import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getFirestore,
  doc,
  setDoc,
  deleteField,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

/* ── Firebase 초기화 ── */
const firebaseConfig = {
  apiKey:            "AIzaSyCrRwRCjQ3n5jrKnM9zZNtfFjSpkQpgTL0",
  authDomain:        "pickup-e1049.firebaseapp.com",
  projectId:         "pickup-e1049",
  storageBucket:     "pickup-e1049.firebasestorage.app",
  messagingSenderId: "86527135002",
  appId:             "1:86527135002:web:0623d5636fee228e9870a3"
};

const app = initializeApp(firebaseConfig);
const db  = getFirestore(app);

const DOC_REF = doc(db, "gonggu", "pickup-data");

/* ── 상태 ── */
const DAYS   = ['일','월','화','수','목','금','토'];
const MONTHS = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];

let cur          = new Date();
let selectedDate = null;
let data         = {};

/* ── Firestore 실시간 동기화 ── */
onSnapshot(DOC_REF, (snapshot) => {
  data = snapshot.exists() ? snapshot.data() : {};
  render();
});

async function saveDate(dateKey, items) {
  try {
    if (items.length === 0) {
      await setDoc(DOC_REF, { [dateKey]: deleteField() }, { merge: true });
    } else {
      await setDoc(DOC_REF, { [dateKey]: items }, { merge: true });
    }
  } catch (e) {
    alert("저장 중 오류가 발생했어요: " + e.message);
  }
}

/* ── Helpers ── */
function makeDateKey(y, m, d) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/* ── Bottom Sheet ── */
function openSheet() {
  document.getElementById('bottom-sheet').classList.add('open');
  document.getElementById('sheet-backdrop').classList.add('open');
}

function closeSheet() {
  document.getElementById('bottom-sheet').classList.remove('open');
  document.getElementById('sheet-backdrop').classList.remove('open');
  selectedDate = null;
  renderCalendar();
}

document.getElementById('sheet-backdrop').addEventListener('click', closeSheet);

/* ── Render ── */
function render() {
  renderCalendar();
  if (selectedDate) renderDetail();
}

function renderCalendar() {
  const y = cur.getFullYear();
  const m = cur.getMonth();
  document.getElementById('month-title').textContent = `${y}년 ${MONTHS[m]}`;

  const grid = document.getElementById('cal-grid');
  grid.innerHTML = '';

  DAYS.forEach(d => {
    const h = document.createElement('div');
    h.className   = 'cal-header';
    h.textContent = d;
    grid.appendChild(h);
  });

  const firstDow = new Date(y, m, 1).getDay();
  const lastDay  = new Date(y, m + 1, 0).getDate();
  const today    = new Date();

  for (let i = 0; i < firstDow; i++) {
    const el = document.createElement('div');
    el.className = 'cal-day empty';
    el.innerHTML = '<span class="day-num">&nbsp;</span>';
    grid.appendChild(el);
  }

  for (let d = 1; d <= lastDay; d++) {
    const key   = makeDateKey(y, m, d);
    const items = data[key] || [];
    const el    = document.createElement('div');
    el.className = 'cal-day';

    if (today.getFullYear() === y && today.getMonth() === m && today.getDate() === d)
      el.classList.add('today');
    if (selectedDate === key)
      el.classList.add('selected');

    // 계정별 dot 표시
    const hasMe  = items.some(i => i.acct === 'me');
    const hasMom = items.some(i => i.acct === 'mom');
    const dotsHtml = (hasMe || hasMom) ? `
      <div class="day-dots">
        ${hasMe  ? '<span class="day-dot dot-me"></span>'  : ''}
        ${hasMom ? '<span class="day-dot dot-mom"></span>' : ''}
      </div>` : '';

    el.innerHTML = `<div class="day-num">${d}</div>${dotsHtml}`;
    el.addEventListener('click', () => selectDate(key));
    grid.appendChild(el);
  }
}

function renderDetail() {
  const dateEl    = document.getElementById('detail-date');
  const listEl    = document.getElementById('items-list');
  const summaryEl = document.getElementById('summary-row');

  const [y, mo, d] = selectedDate.split('-');
  dateEl.textContent = `${y}년 ${parseInt(mo)}월 ${parseInt(d)}일`;

  const items = data[selectedDate] || [];

  if (items.length === 0) {
    listEl.innerHTML        = `<div class="empty-state"><span class="icon">📦</span>픽업 항목이 없어요. 추가해보세요!</div>`;
    summaryEl.style.display = 'none';
    return;
  }

  listEl.innerHTML = items.map((item, idx) => `
    <div class="item-card ${item.acct} ${item.done ? 'done' : ''}">
      <label class="item-check" aria-label="픽업 완료">
        <input type="checkbox" class="check-input" data-key="${selectedDate}" data-idx="${idx}" ${item.done ? 'checked' : ''} />
        <span class="checkmark"></span>
      </label>
      <div class="item-info">
        <div class="item-name">${item.name}</div>
        <div class="item-meta">
          <span class="item-count">${item.qty}개</span>
          <span class="item-price">${Number(item.price).toLocaleString()}원</span>
          <span class="item-acct ${item.acct === 'me' ? 'acct-me' : 'acct-mom'}">
            ${item.acct === 'me' ? '내 계정' : '엄마 계정'}
          </span>
        </div>
      </div>
      <button class="item-del" data-key="${selectedDate}" data-idx="${idx}" aria-label="삭제">🗑</button>
    </div>
  `).join('');

  listEl.querySelectorAll('.check-input').forEach(chk => {
    chk.addEventListener('change', () => {
      toggleDone(chk.dataset.key, parseInt(chk.dataset.idx), chk.checked);
    });
  });

  listEl.querySelectorAll('.item-del').forEach(btn => {
    btn.addEventListener('click', () => {
      deleteItem(btn.dataset.key, parseInt(btn.dataset.idx));
    });
  });

  const activeItems = items.filter(i => !i.done);
  const total    = activeItems.reduce((s, i) => s + Number(i.price) * Number(i.qty), 0);
  const meTotal  = activeItems.filter(i => i.acct === 'me' ).reduce((s, i) => s + Number(i.price) * Number(i.qty), 0);
  const momTotal = activeItems.filter(i => i.acct === 'mom').reduce((s, i) => s + Number(i.price) * Number(i.qty), 0);
  const doneCount = items.filter(i => i.done).length;

  summaryEl.style.display = 'flex';
  summaryEl.innerHTML = `
    <div class="summary-card">
      <div class="summary-label">남은 합계</div>
      <div class="summary-val">${total.toLocaleString()}원</div>
    </div>
    <div class="summary-card">
      <div class="summary-label">내 계정</div>
      <div class="summary-val me">${meTotal.toLocaleString()}원</div>
    </div>
    <div class="summary-card">
      <div class="summary-label">엄마 계정</div>
      <div class="summary-val mom">${momTotal.toLocaleString()}원</div>
    </div>
    <div class="summary-card">
      <div class="summary-label">픽업 완료</div>
      <div class="summary-val" style="color:#3B6D11">${doneCount} / ${items.length}</div>
    </div>
  `;
}

/* ── Actions ── */
function selectDate(key) {
  selectedDate = key;
  renderCalendar();
  renderDetail();
  openSheet();
}

async function toggleDone(key, idx, done) {
  if (!data[key]) return;
  const updated = data[key].map((item, i) =>
    i === idx ? { ...item, done } : item
  );
  await saveDate(key, updated);
}

async function deleteItem(key, idx) {
  if (!data[key]) return;
  const updated = [...data[key]];
  updated.splice(idx, 1);
  await saveDate(key, updated);
}

function openAddForm() {
  if (!selectedDate) return;
  const wrapper = document.getElementById('detail-wrapper');

  const overlay = document.createElement('div');
  overlay.className = 'form-overlay';
  overlay.innerHTML = `
    <div class="form-card">
      <div class="form-title">픽업 항목 추가</div>
      <div class="form-row">
        <label class="form-label" for="f-name">물건 이름 <span class="req">*</span></label>
        <input type="text" id="f-name" placeholder="예: 세제, 과자 세트" />
      </div>
      <div class="form-row">
        <label class="form-label" for="f-qty">개수 <span class="req">*</span></label>
        <input type="number" id="f-qty" placeholder="예: 2" min="1" />
      </div>
      <div class="form-row">
        <label class="form-label" for="f-price">금액 (원) <span class="req">*</span></label>
        <input type="number" id="f-price" placeholder="예: 15000" />
      </div>
      <div class="form-row">
        <label class="form-label" for="f-acct">예약 계정 <span class="req">*</span></label>
        <select id="f-acct">
          <option value="" disabled selected>계정을 선택하세요</option>
          <option value="me">내 계정</option>
          <option value="mom">엄마 계정</option>
        </select>
      </div>
      <div class="form-btns">
        <button class="btn-cancel" id="f-cancel">취소</button>
        <button class="btn-save" id="f-save">저장</button>
      </div>
    </div>
  `;
  wrapper.appendChild(overlay);
  document.getElementById('f-name').focus();

  document.getElementById('f-cancel').addEventListener('click', () => overlay.remove());

  document.getElementById('f-save').addEventListener('click', async () => {
    const name  = document.getElementById('f-name').value.trim();
    const qty   = parseInt(document.getElementById('f-qty').value);
    const price = parseInt(document.getElementById('f-price').value);
    const acct  = document.getElementById('f-acct').value;

    if (!name)        { document.getElementById('f-name').focus();  return; }
    if (!qty || qty < 1) { document.getElementById('f-qty').focus();   return; }
    if (!price && price !== 0) { document.getElementById('f-price').focus(); return; }
    if (isNaN(price)) { document.getElementById('f-price').focus(); return; }
    if (!acct)        { document.getElementById('f-acct').focus();  return; }

    const saveBtn = document.getElementById('f-save');
    saveBtn.textContent = '저장 중...';
    saveBtn.disabled    = true;

    const existing = data[selectedDate] || [];
    await saveDate(selectedDate, [...existing, { name, qty, price, acct, done: false }]);
    overlay.remove();
  });
}

/* ── Event Listeners ── */
document.getElementById('prev-btn').addEventListener('click', () => {
  cur.setMonth(cur.getMonth() - 1);
  render();
});

document.getElementById('next-btn').addEventListener('click', () => {
  cur.setMonth(cur.getMonth() + 1);
  render();
});

document.getElementById('add-btn').addEventListener('click', openAddForm);