/* ============================================================
   DATA-STORE.JS — JSON Persistence Layer
   Saves scoreboard data locally (localStorage) + Cloudflare Worker proxy
   Each day = one JSON file: data/YYYY-MM-DD.json
   The GitHub token is stored securely in the Cloudflare Worker.
   No secrets are ever exposed to the browser.
   ============================================================ */

const DataStore = (() => {
    const LOCAL_PREFIX = 'scoreboard_';
    const SETTINGS_KEY = 'scoreboard_settings';

    // ★ Cloudflare Worker — secure proxy (token lives server-side, never in browser)
    // Worker URL is resolved at call time via getWorkerUrl() below.

    let saveTimeout = null;
    let currentDate = null;

    // ─── Settings (simplified — no token needed) ───
    function getSettings() {
        try {
            return JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {};
        } catch { return {}; }
    }

    function saveSettingsToStorage(settings) {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
        // If a custom worker URL was provided, persist it
        if (settings.workerUrl) {
            localStorage.setItem('scoreboard_worker_url', settings.workerUrl);
        }
    }

    // ─── Date Utilities ───
    function formatDate(date) {
        const d = new Date(date);
        return d.toISOString().split('T')[0]; // YYYY-MM-DD
    }

    function getToday() {
        return formatDate(new Date());
    }

    function getCurrentDate() {
        return currentDate || getToday();
    }

    function setCurrentDate(dateStr) {
        currentDate = dateStr;
    }

    // ─── Empty Scorecard Template ───
    function emptyScorecard(dateStr) {
        return {
            date: dateStr,
            last_updated: new Date().toISOString(),
            created: new Date().toISOString(),
            design: 'executive',

            // Header
            display_date: '',
            day_of_week: '',

            // Target 5
            targets_checked: [],   // e.g. ["1","3","5"]
            calls_made: '',
            appts_set: '',
            followups_sched: '',
            hit_target: '',        // "yes" or "no"
            why_not: '',

            // Call Log (12 rows)
            call_log: Array.from({ length: 12 }, (_, i) => ({
                name: '',
                tier: '',       // "T1", "T2", "T3"
                result: '',     // "S", "VM", "A", "NA", "B", "CB"
                next_step: ''
            })),

            // Follow-ups (5 rows)
            followups: Array.from({ length: 5 }, () => ({
                name: '',
                why: ''
            })),

            // Appointments (5 rows)
            appointments: Array.from({ length: 5 }, () => ({
                name: '',
                details: ''
            })),

            // Daily Review
            review_worked: '',
            review_didnt_work: '',
            review_improve: ''
        };
    }

    // ─── Local Storage ───
    function loadLocal(dateStr) {
        try {
            const raw = localStorage.getItem(LOCAL_PREFIX + dateStr);
            if (raw) return JSON.parse(raw);
        } catch (e) {
            console.warn('Failed to load local data:', e);
        }
        return null;
    }

    function saveLocal(dateStr, data) {
        data.last_updated = new Date().toISOString();
        try {
            localStorage.setItem(LOCAL_PREFIX + dateStr, JSON.stringify(data));
        } catch (e) {
            console.warn('Failed to save locally:', e);
        }
    }

    function listLocalDates() {
        const dates = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key.startsWith(LOCAL_PREFIX) && key !== SETTINGS_KEY) {
                dates.push(key.replace(LOCAL_PREFIX, ''));
            }
        }
        return dates.sort().reverse();
    }

    // ─── Cloudflare Worker Proxy API ───
    function getWorkerUrl() {
        return localStorage.getItem('scoreboard_worker_url')
            || 'https://scoreboard-api.poornima2489.workers.dev';
    }

    async function loadFromCloud(dateStr) {
        try {
            const resp = await fetch(`${getWorkerUrl()}/load/${dateStr}`);
            if (resp.status === 404) return null;
            if (!resp.ok) {
                console.warn('Cloud load error:', resp.status);
                return null;
            }
            return await resp.json();
        } catch (e) {
            console.warn('Cloud load network error:', e);
            return null;
        }
    }

    async function saveToCloud(dateStr, data) {
        try {
            const resp = await fetch(`${getWorkerUrl()}/save/${dateStr}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            if (resp.ok) return true;
            const err = await resp.json().catch(() => ({}));
            console.error('Cloud save error:', err);
            return false;
        } catch (e) {
            console.error('Cloud save network error:', e);
            return false;
        }
    }

    async function listCloudFiles() {
        try {
            const resp = await fetch(`${getWorkerUrl()}/list`);
            if (!resp.ok) return [];
            const result = await resp.json();
            return result.dates || [];
        } catch (e) {
            console.warn('Cloud list error:', e);
            return [];
        }
    }

    async function testConnection() {
        try {
            const resp = await fetch(`${getWorkerUrl()}/health`);
            if (resp.ok) {
                const data = await resp.json();
                return { ok: true, message: `Connected to ${data.repo} ✓` };
            } else {
                return { ok: false, message: `Worker returned ${resp.status}` };
            }
        } catch (e) {
            return { ok: false, message: `Network error: ${e.message}` };
        }
    }

    // ─── Unified Load/Save ───
    async function load(dateStr) {
        // 1. Try local first (instant)
        let data = loadLocal(dateStr);
        
        // 2. Try Cloudflare Worker (cloud) in background
        try {
            const cloudData = await loadFromCloud(dateStr);
            if (cloudData) {
                // Use whichever is newer
                if (!data || new Date(cloudData.last_updated) > new Date(data.last_updated)) {
                    data = cloudData;
                    saveLocal(dateStr, data); // Cache locally
                }
            }
        } catch (e) {
            console.warn('Cloud load failed, using local data:', e);
        }

        // 3. Return data or empty template
        return data || emptyScorecard(dateStr);
    }

    function save(dateStr, data) {
        // Save locally immediately
        saveLocal(dateStr, data);
        updateSaveIndicator('saving');

        // Debounce cloud save (wait 1.5s after last edit)
        if (saveTimeout) clearTimeout(saveTimeout);
        saveTimeout = setTimeout(async () => {
            const success = await saveToCloud(dateStr, data);
            updateSaveIndicator(success ? 'saved' : 'error');
        }, 1500);
    }

    function updateSaveIndicator(state) {
        const el = document.getElementById('saveIndicator');
        if (!el) return;
        el.classList.remove('saving', 'error');
        
        if (state === 'saving') {
            el.classList.add('saving');
            el.innerHTML = '<span class="save-dot"></span> Saving...';
        } else if (state === 'error') {
            el.classList.add('error');
            el.innerHTML = '<span class="save-dot"></span> Sync Error';
        } else if (state === 'local') {
            el.innerHTML = '<span class="save-dot"></span> Saved locally';
        } else {
            el.innerHTML = '<span class="save-dot"></span> Saved ✓';
        }
    }

    // ─── List all saved dates (merged local + cloud) ───
    async function listAllDates() {
        const localDates = listLocalDates();
        let cloudDates = [];
        try {
            cloudDates = await listCloudFiles();
        } catch (e) {
            console.warn('Cloud list failed:', e);
        }
        // Merge and deduplicate
        const all = [...new Set([...localDates, ...cloudDates])];
        return all.sort().reverse();
    }

    return {
        getSettings,
        saveSettingsToStorage,
        getCurrentDate,
        setCurrentDate,
        getToday,
        formatDate,
        emptyScorecard,
        load,
        save,
        loadLocal,
        listAllDates,
        testConnection,
        updateSaveIndicator
    };
})();
