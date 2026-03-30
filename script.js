/* ============================================================
   SCRIPT.JS — UI Controller
   15-row call log · Interactive data entry · Auto-save
   ============================================================ */

const NUM_CALL_ROWS = 15;
const NUM_FOLLOWUP_ROWS = 5;
const NUM_APPT_ROWS = 5;

let currentData = null;
let currentDesign = 'executive';

// ─── INITIALIZATION ───
document.addEventListener('DOMContentLoaded', async () => {
    // Set date picker to today
    const datePicker = document.getElementById('dateSelect');
    const today = DataStore.getToday();
    datePicker.value = today;
    DataStore.setCurrentDate(today);

    // Generate table rows for both designs
    generateCallLog('call-log-body', 'executive');
    generateCallLog('min-call-log-body', 'minimal');
    generateMiniTable('followup-body', NUM_FOLLOWUP_ROWS, 'followup', 'executive');
    generateMiniTable('appt-body', NUM_APPT_ROWS, 'appt', 'executive');
    generateMiniTable('min-followup-body', NUM_FOLLOWUP_ROWS, 'followup', 'minimal');
    generateMiniTable('min-appt-body', NUM_APPT_ROWS, 'appt', 'minimal');

    // Load data for today
    await loadDate(today);

    // Wire up date navigation
    datePicker.addEventListener('change', (e) => loadDate(e.target.value));
    document.getElementById('prevDay').addEventListener('click', () => navigateDay(-1));
    document.getElementById('nextDay').addEventListener('click', () => navigateDay(1));
    document.getElementById('todayBtn').addEventListener('click', () => {
        datePicker.value = DataStore.getToday();
        loadDate(DataStore.getToday());
    });

    // Wire up all interactive elements
    setupClickableElements();
    setupContentEditableListeners();
});

// ─── TABLE GENERATION ───
function generateCallLog(tbodyId, style) {
    const tbody = document.getElementById(tbodyId);
    if (!tbody) return;
    tbody.innerHTML = '';

    for (let i = 0; i < NUM_CALL_ROWS; i++) {
        const tr = document.createElement('tr');
        tr.dataset.rowIndex = i;

        if (style === 'executive') {
            tr.innerHTML = `
                <td class="row-num">${i + 1}</td>
                <td contenteditable="true" data-field="call_name" data-row="${i}"></td>
                <td class="tier-codes">
                    <span class="code-pill clickable" data-field="call_tier" data-row="${i}" data-value="T1">T1</span>
                    <span class="code-pill clickable" data-field="call_tier" data-row="${i}" data-value="T2">T2</span>
                    <span class="code-pill clickable" data-field="call_tier" data-row="${i}" data-value="T3">T3</span>
                </td>
                <td class="result-codes">
                    <span class="code-pill clickable" data-field="call_result" data-row="${i}" data-value="S">S</span>
                    <span class="code-pill clickable" data-field="call_result" data-row="${i}" data-value="VM">VM</span>
                    <span class="code-pill clickable" data-field="call_result" data-row="${i}" data-value="A">A</span>
                    <span class="code-pill clickable" data-field="call_result" data-row="${i}" data-value="NA">NA</span>
                    <span class="code-pill clickable" data-field="call_result" data-row="${i}" data-value="B">B</span>
                    <span class="code-pill clickable" data-field="call_result" data-row="${i}" data-value="CB">CB</span>
                </td>
                <td contenteditable="true" data-field="call_next" data-row="${i}"></td>
            `;
        } else {
            tr.innerHTML = `
                <td style="text-align:center;color:#A0A0A0;font-size:7px;">${i + 1}</td>
                <td contenteditable="true" data-field="call_name" data-row="${i}"></td>
                <td class="tier-codes min-tier-codes">
                    <span class="code-pill min-pill-code clickable" data-field="call_tier" data-row="${i}" data-value="T1">1</span>
                    <span class="code-pill min-pill-code clickable" data-field="call_tier" data-row="${i}" data-value="T2">2</span>
                    <span class="code-pill min-pill-code clickable" data-field="call_tier" data-row="${i}" data-value="T3">3</span>
                </td>
                <td class="result-codes min-result-codes">
                    <span class="code-pill min-pill-code clickable" data-field="call_result" data-row="${i}" data-value="S">S</span>
                    <span class="code-pill min-pill-code clickable" data-field="call_result" data-row="${i}" data-value="VM">VM</span>
                    <span class="code-pill min-pill-code clickable" data-field="call_result" data-row="${i}" data-value="A">A</span>
                    <span class="code-pill min-pill-code clickable" data-field="call_result" data-row="${i}" data-value="NA">NA</span>
                    <span class="code-pill min-pill-code clickable" data-field="call_result" data-row="${i}" data-value="B">B</span>
                    <span class="code-pill min-pill-code clickable" data-field="call_result" data-row="${i}" data-value="CB">CB</span>
                </td>
                <td contenteditable="true" data-field="call_next" data-row="${i}"></td>
            `;
        }
        tbody.appendChild(tr);
    }
}

function generateMiniTable(tbodyId, count, type, style) {
    const tbody = document.getElementById(tbodyId);
    if (!tbody) return;
    tbody.innerHTML = '';

    for (let i = 0; i < count; i++) {
        const tr = document.createElement('tr');
        const field1 = type === 'followup' ? 'fu_name' : 'appt_name';
        const field2 = type === 'followup' ? 'fu_why' : 'appt_details';
        tr.innerHTML = `
            <td contenteditable="true" data-field="${field1}" data-row="${i}"></td>
            <td contenteditable="true" data-field="${field2}" data-row="${i}"></td>
        `;
        tbody.appendChild(tr);
    }
}

// ─── DATA LOADING ───
async function loadDate(dateStr) {
    DataStore.setCurrentDate(dateStr);
    document.getElementById('dateSelect').value = dateStr;

    currentData = await DataStore.load(dateStr);

    // Populate all fields in BOTH designs
    populateDesign('executive');
    populateDesign('minimal');

    // Auto-detect day of week
    const date = new Date(dateStr + 'T12:00:00');
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dayName = days[date.getDay()];

    // Highlight day circles
    document.querySelectorAll('.day-circle, .min-pill').forEach(el => {
        el.classList.toggle('active', el.dataset.day === dayName);
    });

    // Set date display
    const displayDate = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    document.querySelectorAll('[data-field="display_date"]').forEach(el => {
        if (!el.textContent && !currentData.display_date) {
            el.textContent = displayDate;
            currentData.display_date = displayDate;
        } else if (currentData.display_date) {
            el.textContent = currentData.display_date;
        }
    });
}

function populateDesign(design) {
    const container = design === 'executive'
        ? document.getElementById('design-executive')
        : document.getElementById('design-minimal');

    if (!container || !currentData) return;

    // Simple fields
    ['calls_made', 'appts_set', 'followups_sched', 'why_not',
     'review_worked', 'review_didnt_work', 'review_improve', 'display_date'
    ].forEach(field => {
        container.querySelectorAll(`[data-field="${field}"]`).forEach(el => {
            if (el.getAttribute('contenteditable') === 'true') {
                el.textContent = currentData[field] || '';
            }
        });
    });

    // Target circles
    container.querySelectorAll('[data-target]').forEach(el => {
        const val = el.dataset.target;
        el.classList.toggle('checked', (currentData.targets_checked || []).includes(val));
    });

    // Hit target YES/NO
    container.querySelectorAll('[data-field="hit_target"]').forEach(el => {
        el.classList.toggle('active', currentData.hit_target === el.dataset.value);
    });

    // Call log
    for (let i = 0; i < NUM_CALL_ROWS; i++) {
        const row = currentData.call_log[i];
        if (!row) continue;

        const nameEl = container.querySelector(`[data-field="call_name"][data-row="${i}"]`);
        const nextEl = container.querySelector(`[data-field="call_next"][data-row="${i}"]`);
        if (nameEl) nameEl.textContent = row.name || '';
        if (nextEl) nextEl.textContent = row.next_step || '';

        // Highlight saved tier selection
        container.querySelectorAll(`[data-field="call_tier"][data-row="${i}"].code-pill`).forEach(p => {
            p.classList.toggle('selected', row.tier === p.dataset.value);
        });

        // Highlight saved result selection
        container.querySelectorAll(`[data-field="call_result"][data-row="${i}"].code-pill`).forEach(p => {
            p.classList.toggle('selected', row.result === p.dataset.value);
        });
    }

    // Follow-ups
    for (let i = 0; i < NUM_FOLLOWUP_ROWS; i++) {
        const row = currentData.followups[i];
        if (!row) continue;
        const nameEl = container.querySelector(`[data-field="fu_name"][data-row="${i}"]`);
        const whyEl = container.querySelector(`[data-field="fu_why"][data-row="${i}"]`);
        if (nameEl) nameEl.textContent = row.name || '';
        if (whyEl) whyEl.textContent = row.why || '';
    }

    // Appointments
    for (let i = 0; i < NUM_APPT_ROWS; i++) {
        const row = currentData.appointments[i];
        if (!row) continue;
        const nameEl = container.querySelector(`[data-field="appt_name"][data-row="${i}"]`);
        const detEl = container.querySelector(`[data-field="appt_details"][data-row="${i}"]`);
        if (nameEl) nameEl.textContent = row.name || '';
        if (detEl) detEl.textContent = row.details || '';
    }
}

// ─── CLICK HANDLERS ───
function setupClickableElements() {
    document.addEventListener('click', (e) => {
        const el = e.target;

        // Target circles (1-5) — single select (radio behavior)
        if (el.classList.contains('clickable') && el.dataset.target) {
            const val = el.dataset.target;
            const wasChecked = (currentData.targets_checked || []).includes(val);

            // Clear all targets first (single select)
            currentData.targets_checked = [];
            document.querySelectorAll('[data-target]').forEach(c => c.classList.remove('checked'));

            // If it wasn't already checked, select it
            if (!wasChecked) {
                currentData.targets_checked = [val];
                document.querySelectorAll(`[data-target="${val}"]`).forEach(c => c.classList.add('checked'));
            }
            triggerSave();
        }

        // Tier pills (T1/T2/T3) — single select per row
        if (el.classList.contains('code-pill') && el.dataset.field === 'call_tier') {
            const row = parseInt(el.dataset.row);
            const val = el.dataset.value;
            if (!currentData.call_log[row]) return;

            const wasSelected = currentData.call_log[row].tier === val;
            currentData.call_log[row].tier = wasSelected ? '' : val;

            // Clear all tier pills in this row across both designs, then highlight selected
            document.querySelectorAll(`[data-field="call_tier"][data-row="${row}"]`).forEach(p => {
                if (p.classList.contains('code-pill')) p.classList.remove('selected');
            });
            if (!wasSelected) {
                document.querySelectorAll(`[data-field="call_tier"][data-row="${row}"][data-value="${val}"]`).forEach(p => {
                    p.classList.add('selected');
                });
            }
            triggerSave();
        }

        // Result pills (S/VM/A/NA/B/CB) — single select per row
        if (el.classList.contains('code-pill') && el.dataset.field === 'call_result') {
            const row = parseInt(el.dataset.row);
            const val = el.dataset.value;
            if (!currentData.call_log[row]) return;

            const wasSelected = currentData.call_log[row].result === val;
            currentData.call_log[row].result = wasSelected ? '' : val;

            // Clear all result pills in this row across both designs, then highlight selected
            document.querySelectorAll(`[data-field="call_result"][data-row="${row}"]`).forEach(p => {
                if (p.classList.contains('code-pill')) p.classList.remove('selected');
            });
            if (!wasSelected) {
                document.querySelectorAll(`[data-field="call_result"][data-row="${row}"][data-value="${val}"]`).forEach(p => {
                    p.classList.add('selected');
                });
            }
            triggerSave();
        }

        // YES/NO options
        if (el.classList.contains('clickable') && el.dataset.field === 'hit_target') {
            currentData.hit_target = el.dataset.value;
            document.querySelectorAll('[data-field="hit_target"]').forEach(c => {
                c.classList.toggle('active', c.dataset.value === el.dataset.value);
            });
            triggerSave();
        }

        // Day circles
        if ((el.classList.contains('day-circle') || el.classList.contains('min-pill')) && el.dataset.day) {
            document.querySelectorAll('.day-circle, .min-pill').forEach(c => c.classList.remove('active'));
            document.querySelectorAll(`[data-day="${el.dataset.day}"]`).forEach(c => c.classList.add('active'));
            currentData.day_of_week = el.dataset.day;
            triggerSave();
        }
    });
}

// ─── CONTENTEDITABLE LISTENERS ───
function setupContentEditableListeners() {
    document.addEventListener('input', (e) => {
        const el = e.target;
        if (!el.dataset || !el.dataset.field) return;
        if (!currentData) return;

        const field = el.dataset.field;
        const row = el.dataset.row !== undefined ? parseInt(el.dataset.row) : null;
        const text = el.textContent.trim();

        // Simple top-level fields
        if (row === null) {
            currentData[field] = text;
            // Sync to other design's matching field
            document.querySelectorAll(`[data-field="${field}"]`).forEach(other => {
                if (other !== el && other.getAttribute('contenteditable') === 'true') {
                    other.textContent = text;
                }
            });
        }
        // Call log fields
        else if (field === 'call_name') {
            if (currentData.call_log[row]) currentData.call_log[row].name = text;
        } else if (field === 'call_next') {
            if (currentData.call_log[row]) currentData.call_log[row].next_step = text;
        }
        // Follow-up fields
        else if (field === 'fu_name') {
            if (currentData.followups[row]) currentData.followups[row].name = text;
        } else if (field === 'fu_why') {
            if (currentData.followups[row]) currentData.followups[row].why = text;
        }
        // Appointment fields
        else if (field === 'appt_name') {
            if (currentData.appointments[row]) currentData.appointments[row].name = text;
        } else if (field === 'appt_details') {
            if (currentData.appointments[row]) currentData.appointments[row].details = text;
        }

        triggerSave();
    });
}

// ─── SAVE ───
function triggerSave() {
    if (!currentData) return;
    const dateStr = DataStore.getCurrentDate();
    currentData.design = currentDesign;
    DataStore.save(dateStr, currentData);
}

// ─── DATE NAVIGATION ───
function navigateDay(offset) {
    const current = DataStore.getCurrentDate();
    const date = new Date(current + 'T12:00:00');
    date.setDate(date.getDate() + offset);
    const newDate = DataStore.formatDate(date);
    loadDate(newDate);
}

// ─── DESIGN SWITCHING ───
function switchDesign(design) {
    currentDesign = design;
    const exec = document.getElementById('design-executive');
    const min = document.getElementById('design-minimal');

    exec.style.display = design === 'executive' ? 'block' : 'none';
    min.style.display = design === 'minimal' ? 'block' : 'none';

    document.querySelectorAll('.tab').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.design === design);
    });

    if (currentData) {
        currentData.design = design;
        triggerSave();
    }
}

// ─── MODALS ───
function showDownloads() {
    document.getElementById('downloadsModal').style.display = 'flex';
}

function showSettings() {
    document.getElementById('workerUrl').value =
        localStorage.getItem('scoreboard_worker_url') || '';
    document.getElementById('syncStatus').className = 'sync-status';
    document.getElementById('syncStatus').style.display = 'none';
    document.getElementById('settingsModal').style.display = 'flex';

    // Auto-test connection when opening
    testCloudConnection();
}

function saveSettings() {
    const customUrl = document.getElementById('workerUrl').value.trim();
    if (customUrl) {
        localStorage.setItem('scoreboard_worker_url', customUrl);
    } else {
        localStorage.removeItem('scoreboard_worker_url');
    }
    DataStore.saveSettingsToStorage({ workerUrl: customUrl || '' });

    const status = document.getElementById('syncStatus');
    status.className = 'sync-status success';
    status.textContent = '✓ Settings saved.';
    status.style.display = 'block';

    setTimeout(() => closeModal('settingsModal'), 1200);
}

async function testCloudConnection() {
    const box = document.getElementById('connectionBox');
    box.style.background = '#DBEAFE';
    box.style.color = '#1E40AF';
    box.innerHTML = '<span style="font-size:18px;">⏳</span><span>Testing connection…</span>';

    const result = await DataStore.testConnection();

    if (result.ok) {
        box.style.background = '#D1FAE5';
        box.style.color = '#065F46';
        box.innerHTML = `<span style="font-size:18px;">✅</span><span>${result.message}</span>`;
    } else {
        box.style.background = '#FEE2E2';
        box.style.color = '#991B1B';
        box.innerHTML = `<span style="font-size:18px;">❌</span><span>${result.message}</span>`;
    }
}

async function showHistory() {
    document.getElementById('historyModal').style.display = 'flex';
    const list = document.getElementById('historyList');
    list.innerHTML = '<p class="loading">Loading...</p>';

    const dates = await DataStore.listAllDates();

    if (dates.length === 0) {
        list.innerHTML = '<p class="loading">No saved scorecards yet. Start filling in today\'s and it will appear here.</p>';
        return;
    }

    list.innerHTML = '';
    for (const dateStr of dates) {
        const data = DataStore.loadLocal(dateStr);
        const date = new Date(dateStr + 'T12:00:00');
        const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
        const displayDate = date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
        
        const card = document.createElement('div');
        card.className = 'history-card';
        card.onclick = () => { closeModal('historyModal'); loadDate(dateStr); };
        
        const calls = data?.calls_made || '—';
        const appts = data?.appts_set || '—';
        const target = data?.targets_checked?.length || 0;
        const hit = data?.hit_target === 'yes' ? '✓ Yes' : data?.hit_target === 'no' ? '✗ No' : '—';

        card.innerHTML = `
            <div>
                <div class="history-date">${displayDate}</div>
                <div class="history-day">${dayName}</div>
            </div>
            <div class="history-stats">
                <span class="history-stat">🎯 <strong>${target}/5</strong></span>
                <span class="history-stat">📞 <strong>${calls}</strong> calls</span>
                <span class="history-stat">📅 <strong>${appts}</strong> appts</span>
                <span class="history-stat">Hit: <strong>${hit}</strong></span>
            </div>
        `;
        list.appendChild(card);
    }
}

function closeModal(id) {
    document.getElementById(id).style.display = 'none';
}

// Close modals on overlay click
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay')) {
        e.target.style.display = 'none';
    }
});

// Close modals on Escape
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        document.querySelectorAll('.modal-overlay').forEach(m => m.style.display = 'none');
    }
});
