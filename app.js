const app = document.getElementById('app');
const NA = 6.022e23;

const state = {
  view: 'knowledge',
  subject: 'toan',
  grade: 'all',
  query: '',
};

const openCards = new Set();
let molMode = 'mass';
const conv = { cat: 'length', value: '1', from: 'km', to: 'm' };

const MOL_MODES = [
  { id: 'mass', label: 'Khối lượng' },
  { id: 'gas', label: 'Thể tích khí' },
  { id: 'solution', label: 'Dung dịch' },
  { id: 'particle', label: 'Số hạt' },
];

const MOL_FORMULAS = [
  { name: 'Số mol theo khối lượng', expr: 'n = m/M' },
  { name: 'Khối lượng', expr: 'm = n · M' },
  { name: 'Thể tích khí ở đktc (0 °C, 1 atm)', expr: 'V = n · 22,4' },
  { name: 'Thể tích khí ở đkc (25 °C, 1 bar)', expr: 'V = n · 24,79' },
  { name: 'Số mol theo nồng độ mol', expr: 'n = C<sub>M</sub> · V<sub>dd</sub>' },
  { name: 'Số hạt', expr: 'N = n · 6,022 · 10<sup>23</sup>' },
  { name: 'Nồng độ phần trăm', expr: 'C% = (m<sub>ct</sub>/m<sub>dd</sub>) · 100%' },
];

function normalize(text) {
  return String(text)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd');
}

function stripHtml(text) {
  return String(text).replace(/<[^>]*>/g, ' ');
}

function matchesQuery(entry, query) {
  const needle = normalize(query.trim());
  if (!needle) return true;
  const haystack = normalize([
    entry.title,
    entry.topic,
    entry.grade,
    ...entry.formulas.flatMap((formula) => [formula.name || '', stripHtml(formula.expr || ''), formula.note || '']),
  ].join(' '));
  return needle.split(/\s+/).every((word) => haystack.includes(word));
}

function parseNum(raw) {
  if (typeof raw !== 'string' || raw.trim() === '') return null;
  const cleaned = raw.trim().replace(/\s/g, '').replace(/,/g, '.');
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

function fmt(value, maxDigits = 4) {
  if (!Number.isFinite(value)) return '—';
// Sửa tại dòng 65 - 74:
function setView(view) {
  const validViews = ['knowledge', 'mol', 'convert'];
  const target = validViews.includes(view) ? view : 'knowledge';
  state.view = target;
  if (window.location.hash !== `#${target}`) {
    history.replaceState(null, '', `#${target}`);
  }
  document.querySelectorAll('.nav-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.view === target);
  });
  if (target === 'knowledge') renderKnowledge();
  else if (target === 'mol') renderMol();
  else renderConvert();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function setView(view) {
  state.view = view;
  document.querySelectorAll('.nav-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.view === view);
  });
  if (view === 'knowledge') renderKnowledge();
  else if (view === 'mol') renderMol();
  else renderConvert();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* Knowledge */

function renderKnowledge() {
  const counts = {
    toan: KNOWLEDGE.toan.length,
    ly: KNOWLEDGE.ly.length,
    hoa: KNOWLEDGE.hoa.length,
  };
  app.innerHTML = `
    <section class="hero view">
      <div class="hero-content">
        <p class="kicker">TLHMaster · THCS &amp; THPT</p>
        <h1>Kho kiến thức <span class="grad">Toán · Lý · Hóa</span></h1>
        <p class="hero-sub">Tóm tắt công thức, định luật và tính chất trọng tâm từ lớp 6 đến lớp 12. Gõ từ khóa không dấu vẫn tìm được.</p>
        <div class="search-box">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"></circle><path d="M20 20l-3.5-3.5"></path></svg>
          <input id="searchInput" type="search" placeholder="Tìm công thức, định luật… (vd: đạo hàm, Vi-ét, OHM)" autocomplete="off" aria-label="Tìm kiếm kiến thức" />
        </div>
        <div class="hero-meta">
          <span>📐 Toán ${counts.toan} chủ đề</span>
          <span>⚛️ Vật lí ${counts.ly} chủ đề</span>
          <span>🧪 Hóa học ${counts.hoa} chủ đề</span>
        </div>
      </div>
    </section>
    <div class="subject-tabs" id="subjectTabs">
      ${SUBJECTS.map((subject) => `
        <button class="subject-tab" data-subject="${subject.id}">
          <span aria-hidden="true">${subject.icon}</span>${subject.name}
          <span class="count">${counts[subject.id]}</span>
        </button>`).join('')}
    </div>
    <div class="grade-row" id="gradeRow">
      <span class="grade-label">Lớp</span>
      <button class="grade-chip" data-grade="all">Tất cả</button>
      ${['6', '7', '8', '9', '10', '11', '12'].map((grade) => `<button class="grade-chip" data-grade="${grade}">${grade}</button>`).join('')}
    </div>
    <p class="result-meta" id="resultMeta"></p>
    <div class="k-list" id="kList"></div>
  `;

  const search = app.querySelector('#searchInput');
  search.value = state.query;
  search.addEventListener('input', () => {
    state.query = search.value;
    renderList();
  });

  const syncTabs = () => {
    app.querySelectorAll('.subject-tab').forEach((tab) => {
      tab.classList.toggle('active', tab.dataset.subject === state.subject);
    });
    app.querySelectorAll('.grade-chip').forEach((chip) => {
      chip.classList.toggle('active', chip.dataset.grade === state.grade);
    });
  };

  app.querySelectorAll('.subject-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      state.subject = tab.dataset.subject;
      syncTabs();
      renderList();
    });
  });
  app.querySelectorAll('.grade-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      state.grade = chip.dataset.grade;
      syncTabs();
      renderList();
    });
  });

  syncTabs();
  renderList();
}

function renderList() {
  const entries = KNOWLEDGE[state.subject];
  const filtered = [];
  entries.forEach((entry, index) => {
    if (state.grade !== 'all' && entry.grade !== state.grade) return;
    if (!matchesQuery(entry, state.query)) return;
    filtered.push({ entry, key: `${state.subject}-${index}` });
  });

  const subjectName = SUBJECTS.find((subject) => subject.id === state.subject).name;
  const gradeText = state.grade === 'all' ? 'tất cả các lớp' : `lớp ${state.grade}`;
  const queryText = state.query.trim() ? ` cho “${state.query.trim()}”` : '';
  app.querySelector('#resultMeta').textContent = `${filtered.length} chủ đề · ${subjectName} · ${gradeText}${queryText}`;

  const list = app.querySelector('#kList');
  list.className = `k-list ${state.subject}`;
  if (!filtered.length) {
    list.innerHTML = `
      <div class="empty">
        <strong>Không tìm thấy kết quả</strong>
        Thử từ khóa khác hoặc chọn lớp khác nhé.
      </div>`;
    return;
  }
  list.innerHTML = filtered.map(({ entry, key }) => cardHTML(entry, key)).join('');
  list.querySelectorAll('details').forEach((card) => {
    card.addEventListener('toggle', () => {
      if (card.open) openCards.add(card.dataset.key);
      else openCards.delete(card.dataset.key);
    });
  });
}

function cardHTML(entry, key) {
  const isOpen = openCards.has(key) ? ' open' : '';
  return `
    <details class="k-card" data-key="${key}"${isOpen}>
      <summary>
        <span class="grade-badge"><small>Lớp</small><b>${entry.grade}</b></span>
        <span class="k-title-wrap">
          <span class="k-topic">${entry.topic}</span>
          <span class="k-title">${entry.title}</span>
        </span>
        <span class="k-meta">${entry.formulas.length} mục</span>
        <span class="chev" aria-hidden="true">▾</span>
      </summary>
      <div class="k-body">
        <ul class="formulas">
          ${entry.formulas.map((formula) => `
            <li>
              <div class="f-name">${formula.name}</div>
              <div class="f-expr">${formula.expr}</div>
              ${formula.note ? `<div class="f-note">${formula.note}</div>` : ''}
            </li>`).join('')}
        </ul>
      </div>
    </details>`;
}

/* Mol calculator */

function renderMol() {
  app.innerHTML = `
    <section class="tool-head view">
      <p class="kicker">Công cụ hóa học</p>
      <h1>Máy tính số mol</h1>
      <p class="sub">Tính số mol từ khối lượng, thể tích khí, nồng độ dung dịch hoặc số hạt. Kết quả hiển thị kèm cách tính.</p>
    </section>
    <div class="tool-grid view">
      <section class="panel calc-panel">
        <div class="seg" id="molSeg">
          ${MOL_MODES.map((mode) => `<button class="seg-btn${mode.id === molMode ? ' active' : ''}" data-mode="${mode.id}">${mode.label}</button>`).join('')}
        </div>
        <div id="molForm"></div>
      </section>
      <aside class="panel formula-panel">
        <h2>Công thức cần nhớ</h2>
        <p>Đơn vị chuẩn: m (g), M (g/mol), V (lít), C<sub>M</sub> (mol/L).</p>
        <ul class="ref-list">
          ${MOL_FORMULAS.map((item) => `<li><div class="ref-name">${item.name}</div><div class="ref-expr">${item.expr}</div></li>`).join('')}
        </ul>
      </aside>
    </div>
  `;

  app.querySelectorAll('#molSeg .seg-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      molMode = btn.dataset.mode;
      app.querySelectorAll('#molSeg .seg-btn').forEach((item) => item.classList.toggle('active', item === btn));
      renderMolForm();
    });
  });

  renderMolForm();
}

function renderMolForm() {
  const holder = app.querySelector('#molForm');
  const parse = (selector) => parseNum(holder.querySelector(selector).value);
  const showError = (message) => {
    holder.querySelector('#molResult').innerHTML = `<p class="form-error">${message}</p>`;
  };

  const result = (payload) => {
    holder.querySelector('#molResult').innerHTML = `
      <div class="calc-result">
        <p class="calc-label">${payload.label}</p>
        <p class="calc-value">${payload.value}</p>
        <div class="calc-steps">${payload.steps.map((step) => `<p>${step}</p>`).join('')}</div>
        <div class="calc-extras">${payload.extras.map((extra) => `<span class="calc-chip">${extra}</span>`).join('')}</div>
      </div>`;
  };

  if (molMode === 'mass') {
    holder.innerHTML = `
      <form id="molFormEl" novalidate>
        <div class="form-grid">
          <label class="field">
            <span>Khối lượng <em>m (gam)</em></span>
            <input id="in-m" inputmode="decimal" placeholder="Ví dụ: 10" autocomplete="off">
          </label>
          <label class="field">
            <span>Khối lượng mol <em>M (g/mol)</em></span>
            <input id="in-M" inputmode="decimal" placeholder="Ví dụ: 40" autocomplete="off">
          </label>
        </div>
        <p class="form-hint">Ví dụ: 10 g CaCO₃ (M = 100 g/mol) → n = 0,1 mol.</p>
        <button class="btn-primary" type="submit">Tính số mol</button>
        <div id="molResult" class="result-slot"></div>
      </form>`;
    holder.querySelector('#molFormEl').addEventListener('submit', (event) => {
      event.preventDefault();
      const m = parse('#in-m');
      const M = parse('#in-M');
      if (m === null || M === null || m < 0 || M <= 0) {
        showError('Vui lòng nhập khối lượng m ≥ 0 và khối lượng mol M > 0.');
        return;
      }
      const n = m / M;
      result({
        label: 'Số mol',
        value: `n = <span>${fmt(n)}</span> mol`,
        steps: [`n = m / M = ${fmt(m)} / ${fmt(M)} = ${fmt(n)} mol`],
        extras: [
          `V (đktc) = ${fmt(n * 22.4)} lít`,
          `V (đkc) = ${fmt(n * 24.79)} lít`,
          `N ≈ ${fmt(n * NA)} hạt`,
        ],
      });
    });
  } else if (molMode === 'gas') {
    holder.innerHTML = `
      <form id="molFormEl" novalidate>
        <div class="form-grid">
          <label class="field">
            <span>Thể tích khí <em>V (lít)</em></span>
            <input id="in-V" inputmode="decimal" placeholder="Ví dụ: 5,6" autocomplete="off">
          </label>
          <label class="field">
            <span>Điều kiện</span>
            <select id="in-cond">
              <option value="22.4">Đktc · 0 °C, 1 atm (22,4 L/mol)</option>
              <option value="24.79">Đkc · 25 °C, 1 bar (24,79 L/mol)</option>
            </select>
          </label>
        </div>
        <p class="form-hint">Lưu ý: 1 lít = 1000 mL; 1 mL = 0,001 lít.</p>
        <button class="btn-primary" type="submit">Tính số mol</button>
        <div id="molResult" class="result-slot"></div>
      </form>`;
    holder.querySelector('#molFormEl').addEventListener('submit', (event) => {
      event.preventDefault();
      const V = parse('#in-V');
      const vm = Number(holder.querySelector('#in-cond').value);
      if (V === null || V < 0) {
        showError('Vui lòng nhập thể tích V ≥ 0 (đơn vị lít).');
        return;
      }
      const n = V / vm;
      result({
        label: 'Số mol khí',
        value: `n = <span>${fmt(n)}</span> mol`,
        steps: [`n = V / V<sub>m</sub> = ${fmt(V)} / ${fmt(vm)} = ${fmt(n)} mol`],
        extras: [
          vm === 22.4 ? `V (đkc) = ${fmt(n * 24.79)} lít` : `V (đktc) = ${fmt(n * 22.4)} lít`,
          `N ≈ ${fmt(n * NA)} phân tử`,
        ],
      });
    });
  } else if (molMode === 'solution') {
    holder.innerHTML = `
      <form id="molFormEl" novalidate>
        <div class="form-grid">
          <label class="field">
            <span>Nồng độ mol <em>C<sub>M</sub> (mol/L)</em></span>
            <input id="in-C" inputmode="decimal" placeholder="Ví dụ: 0,5" autocomplete="off">
          </label>
          <label class="field">
            <span>Thể tích dung dịch <em>V<sub>dd</sub> (lít)</em></span>
            <input id="in-V" inputmode="decimal" placeholder="Ví dụ: 0,25" autocomplete="off">
          </label>
        </div>
        <p class="form-hint">Quy đổi: 250 mL = 0,25 lít; 500 mL = 0,5 lít.</p>
        <button class="btn-primary" type="submit">Tính số mol</button>
        <div id="molResult" class="result-slot"></div>
      </form>`;
    holder.querySelector('#molFormEl').addEventListener('submit', (event) => {
      event.preventDefault();
      const C = parse('#in-C');
      const V = parse('#in-V');
      if (C === null || V === null || C < 0 || V < 0) {
        showError('Vui lòng nhập nồng độ C<sub>M</sub> ≥ 0 và thể tích V ≥ 0.');
        return;
      }
      const n = C * V;
      result({
        label: 'Số mol chất tan',
        value: `n = <span>${fmt(n)}</span> mol`,
        steps: [
          `n = C<sub>M</sub> · V<sub>dd</sub> = ${fmt(C)} · ${fmt(V)} = ${fmt(n)} mol`,
          `V<sub>dd</sub> đang dùng: ${fmt(V)} lít (${fmt(V * 1000)} mL)`,
        ],
        extras: [
          `N ≈ ${fmt(n * NA)} hạt`,
          `V khí (đktc) nếu có: ${fmt(n * 22.4)} lít`,
        ],
      });
    });
  } else {
    holder.innerHTML = `
      <form id="molFormEl" novalidate>
        <div class="form-grid single">
          <label class="field">
            <span>Số hạt (phân tử, nguyên tử) <em>N</em></span>
            <input id="in-N" inputmode="decimal" placeholder="Ví dụ: 3,011e23" autocomplete="off">
          </label>
        </div>
        <p class="form-hint">Có thể nhập dạng 3,011e23 hoặc 602200000000000000000000.</p>
        <button class="btn-primary" type="submit">Tính số mol</button>
        <div id="molResult" class="result-slot"></div>
      </form>`;
    holder.querySelector('#molFormEl').addEventListener('submit', (event) => {
      event.preventDefault();
      const N = parse('#in-N');
      if (N === null || N < 0) {
        showError('Vui lòng nhập số hạt N ≥ 0.');
        return;
      }
      const n = N / NA;
      result({
        label: 'Số mol',
        value: `n = <span>${fmt(n)}</span> mol`,
        steps: [`n = N / N<sub>A</sub> = ${fmt(N)} / ${fmt(NA)} = ${fmt(n)} mol`],
        extras: [
          `V (đktc) = ${fmt(n * 22.4)} lít`,
          `V (đkc) = ${fmt(n * 24.79)} lít`,
        ],
      });
    });
  }
}

/* Unit conversion */

function toCelsius(value, unit) {
  if (unit === 'c') return value;
  if (unit === 'f') return (value - 32) * 5 / 9;
  return value - 273.15;
}

function fromCelsius(value, unit) {
  if (unit === 'c') return value;
  if (unit === 'f') return value * 9 / 5 + 32;
  return value + 273.15;
}

function convertValue(cat, value, fromId, toId) {
  if (fromId === toId) return value;
  if (cat.special === 'temperature') {
    return fromCelsius(toCelsius(value, fromId), toId);
  }
  const from = cat.units.find((unit) => unit.id === fromId);
  const to = cat.units.find((unit) => unit.id === toId);
  return value * from.factor / to.factor;
}

function renderConvert() {
  const cat = CONVERSIONS[conv.cat];
  if (!cat.units.some((unit) => unit.id === conv.from)) conv.from = cat.units[0].id;
  if (!cat.units.some((unit) => unit.id === conv.to)) conv.to = (cat.units[1] || cat.units[0]).id;

  const unitOptions = (selected) => cat.units
    .map((unit) => `<option value="${unit.id}"${unit.id === selected ? ' selected' : ''}>${unit.symbol} — ${unit.name}</option>`)
    .join('');

  app.innerHTML = `
    <section class="tool-head view">
      <p class="kicker">Bảng quy đổi</p>
      <h1>Quy đổi đơn vị</h1>
      <p class="sub">Chuyển đổi nhanh các đại lượng thường gặp và tra bảng quy đổi chi tiết.</p>
    </section>
    <div class="cat-chips view" id="catChips">
      ${Object.entries(CONVERSIONS).map(([id, item]) => `
        <button class="cat-chip${id === conv.cat ? ' active' : ''}" data-cat="${id}">
          <span aria-hidden="true">${item.icon}</span>${item.name}
        </button>`).join('')}
    </div>
    <section class="panel convert-card view">
      <div class="convert-grid">
        <label class="field">
          <span>Giá trị</span>
          <div class="convert-row">
            <input id="convValue" inputmode="decimal" value="${conv.value}" autocomplete="off" aria-label="Giá trị cần quy đổi">
            <select id="convFrom" aria-label="Đơn vị nguồn">${unitOptions(conv.from)}</select>
          </div>
        </label>
        <button class="swap-btn" id="swapBtn" aria-label="Đổi chiều quy đổi">⇄</button>
        <div class="field">
          <span>Kết quả</span>
          <div class="convert-row">
            <div class="conv-output" id="convResult">—</div>
            <select id="convTo" aria-label="Đơn vị đích">${unitOptions(conv.to)}</select>
          </div>
        </div>
      </div>
      <p class="conv-formula" id="convFormula"></p>
    </section>
    <section class="panel table-panel view">
      <h2>Bảng quy đổi — ${cat.name}</h2>
      <div class="table-wrap">${tableHTML(cat)}</div>
      <p class="table-note">${cat.note}</p>
    </section>
  `;

  app.querySelectorAll('.cat-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      conv.cat = chip.dataset.cat;
      const next = CONVERSIONS[conv.cat];
      conv.from = next.units[0].id;
      conv.to = (next.units[1] || next.units[0]).id;
      renderConvert();
    });
  });

  const input = app.querySelector('#convValue');
  input.addEventListener('input', () => {
    conv.value = input.value;
    updateConvert();
  });
  app.querySelector('#convFrom').addEventListener('change', (event) => {
    conv.from = event.target.value;
    updateConvert();
  });
  app.querySelector('#convTo').addEventListener('change', (event) => {
    conv.to = event.target.value;
    updateConvert();
  });
  app.querySelector('#swapBtn').addEventListener('click', () => {
    [conv.from, conv.to] = [conv.to, conv.from];
    app.querySelector('#convFrom').value = conv.from;
    app.querySelector('#convTo').value = conv.to;
    updateConvert();
  });

  updateConvert();
}

function updateConvert() {
  const cat = CONVERSIONS[conv.cat];
  const out = app.querySelector('#convResult');
  const formula = app.querySelector('#convFormula');
  const parsed = parseNum(conv.value);

  if (conv.value.trim() === '' || parsed === null) {
    out.textContent = '—';
    formula.textContent = 'Nhập giá trị để quy đổi.';
    return;
  }

  const result = convertValue(cat, parsed, conv.from, conv.to);
  const fromUnit = cat.units.find((unit) => unit.id === conv.from);
  const toUnit = cat.units.find((unit) => unit.id === conv.to);
  out.innerHTML = fmt(result, 6);
  formula.innerHTML = `${fmt(parsed, 6)} ${fromUnit.symbol} = ${fmt(result, 6)} ${toUnit.symbol}`;
}

function tableHTML(cat) {
  if (cat.special === 'temperature') {
    return `
      <table>
        <thead><tr><th>Quy đổi</th><th>Công thức</th></tr></thead>
        <tbody>
          <tr><td>Độ C → Độ F</td><td class="factor">°F = °C × 9/5 + 32</td></tr>
          <tr><td>Độ F → Độ C</td><td class="factor">°C = (°F − 32) × 5/9</td></tr>
          <tr><td>Độ C → Kelvin</td><td class="factor">K = °C + 273,15</td></tr>
          <tr><td>Kelvin → Độ C</td><td class="factor">°C = K − 273,15</td></tr>
          <tr><td>Độ F → Kelvin</td><td class="factor">K = (°F − 32) × 5/9 + 273,15</td></tr>
          <tr><td>Nước đóng băng</td><td class="factor">0 °C = 32 °F = 273,15 K</td></tr>
          <tr><td>Nước sôi (1 atm)</td><td class="factor">100 °C = 212 °F = 373,15 K</td></tr>
        </tbody>
      </table>`;
  }

  const base = cat.units.find((unit) => unit.factor === 1) || cat.units[0];
  return `
    <table>
      <thead><tr><th>Đơn vị</th><th>Ký hiệu</th><th>Quy đổi</th></tr></thead>
      <tbody>
        ${cat.units.map((unit) => `
          <tr>
            <td>${unit.name}</td>
            <td class="sym">${unit.symbol}</td>
            <td class="factor">1 ${unit.symbol} = ${fmt(unit.factor, 10)} ${base.symbol}</td>
          </tr>`).join('')}
      </tbody>
    </table>`;
}

/* Init */

document.getElementById('brandBtn').addEventListener('click', () => setView('knowledge'));
// Sửa tại 6 dòng cuối cùng của app.js:
document.getElementById('brandBtn').addEventListener('click', () => setView('knowledge'));
document.querySelectorAll('.nav-btn').forEach((btn) => {
  btn.addEventListener('click', () => setView(btn.dataset.view));
});
window.addEventListener('hashchange', () => setView(window.location.hash.slice(1)));

setView(window.location.hash.slice(1) || 'knowledge');}
