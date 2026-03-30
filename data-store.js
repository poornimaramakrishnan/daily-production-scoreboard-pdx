/* ============================================================
   DATA-STORE.JS — JSON Persistence Layer
   Saves scoreboard data locally (localStorage) + GitHub API
   Each day = one JSON file: data/YYYY-MM-DD.json
   ============================================================ */

const DataStore = (() => {
    const LOCAL_PREFIX = 'scoreboard_';
    const SETTINGS_KEY = 'scoreboard_settings';
    let saveTimeout = null;
    let currentDate = null;

    // ─── Settings ───
    function getSettings() {
        try {
            return JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {};
        } catch { return {}; }
    }

    function saveSettingsToStorage(settings) {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
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

            // Call Log (15 rows)
            call_log: Array.from({ length: 15 }, (_, i) => ({
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

    // ─── GitHub API ───
    async function ghRequest(method, path, body = null) {
        const settings = getSettings();
        if (!settings.token || !settings.repo) return null;

        const url = `https://api.github.com/repos/${settings.repo}/contents/${path}`;
        const headers = {
            'Authorization': `token ${settings.token}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json'
        };

        const opts = { method, headers };
        if (body) opts.body = JSON.stringify(body);

        try {
            const resp = await fetch(url, opts);
            if (resp.status === 404) return { notFound: true };
            if (!resp.ok) {
                const err = await resp.json().catch(() => ({}));
                console.error('GitHub API error:', resp.status, err);
                return { error: true, status: resp.status, message: err.message };
            }
            return await resp.json();
        } catch (e) {
            console.error('GitHub API network error:', e);
            return { error: true, message: e.message };
        }
    }

    async function loadFromGitHub(dateStr) {
        const path = `data/${dateStr}.json`;
        const settings = getSettings();
        if (!settings.token || !settings.repo) return null;

        const result = await ghRequest('GET', path + `?ref=${settings.branch || 'main'}`);
        if (!result || result.notFound || result.error) return null;

        try {
            const content = atob(result.content);
            return JSON.parse(content);
        } catch (e) {
            console.warn('Failed to parse GitHub data:', e);
            return null;
        }
    }

    async function saveToGitHub(dateStr, data) {
        const settings = getSettings();
        if (!settings.token || !settings.repo) return false;

        const path = `data/${dateStr}.json`;
        const content = btoa(unescape(encodeURIComponent(JSON.stringify(data, null, 2))));
        
        // Check if file exists (need sha for updates)
        const existing = await ghRequest('GET', path + `?ref=${settings.branch || 'main'}`);
        
        const body = {
            message: `Update scorecard: ${dateStr} at ${new Date().toLocaleTimeString()}`,
            content: content,
            branch: settings.branch || 'main'
        };

        if (existing && !existing.notFound && !existing.error && existing.sha) {
            body.sha = existing.sha; // Required for file updates
        }

        const result = await ghRequest('PUT', path, body);
        return result && !result.error;
    }

    async function listGitHubFiles() {
        const settings = getSettings();
        if (!settings.token || !settings.repo) return [];

        const result = await ghRequest('GET', `data?ref=${settings.branch || 'main'}`);
        if (!result || result.notFound || result.error || !Array.isArray(result)) return [];

        return result
            .filter(f => f.name.endsWith('.json'))
            .map(f => f.name.replace('.json', ''))
            .sort()
            .reverse();
    }

    async function testConnection() {
        const settings = getSettings();
        if (!settings.token || !settings.repo) {
            return { ok: false, message: 'Token and repo are required.' };
        }

        try {
            const url = `https://api.github.com/repos/${settings.repo}`;
            const resp = await fetch(url, {
                headers: {
                    'Authorization': `token ${settings.token}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });
            if (resp.ok) {
                const repo = await resp.json();
                return { ok: true, message: `Connected to ${repo.full_name} ✓` };
            } else {
                return { ok: false, message: `Error ${resp.status}: Check token and repo name.` };
            }
        } catch (e) {
            return { ok: false, message: `Network error: ${e.message}` };
        }
    }

    // ─── Unified Load/Save ───
    async function load(dateStr) {
        // 1. Try local first (instant)
        let data = loadLocal(dateStr);
        
        // 2. Try GitHub in background
        const settings = getSettings();
        if (settings.token && settings.repo) {
            const ghData = await loadFromGitHub(dateStr);
            if (ghData) {
                // Use whichever is newer
                if (!data || new Date(ghData.last_updated) > new Date(data.last_updated)) {
                    data = ghData;
                    saveLocal(dateStr, data); // Cache locally
                }
            }
        }

        // 3. Return data or empty template
        return data || emptyScorecard(dateStr);
    }

    function save(dateStr, data) {
        // Save locally immediately
        saveLocal(dateStr, data);
        updateSaveIndicator('saving');

        // Debounce GitHub save (wait 1.5s after last edit)
        if (saveTimeout) clearTimeout(saveTimeout);
        saveTimeout = setTimeout(async () => {
            const settings = getSettings();
            if (settings.token && settings.repo) {
                const success = await saveToGitHub(dateStr, data);
                updateSaveIndicator(success ? 'saved' : 'error');
            } else {
                updateSaveIndicator('local');
            }
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

    // ─── List all saved dates (merged local + GitHub) ───
    async function listAllDates() {
        const localDates = listLocalDates();
        const settings = getSettings();
        let ghDates = [];
        if (settings.token && settings.repo) {
            ghDates = await listGitHubFiles();
        }
        // Merge and deduplicate
        const all = [...new Set([...localDates, ...ghDates])];
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
