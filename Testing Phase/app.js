// ══════════════════════════════════════════════════════════
//  CSRD NG911 — Testing Report Engine
//  Interactive status tracking with localStorage persistence
// ══════════════════════════════════════════════════════════

const STORAGE_KEY = 'ng911_test_results';

const PHASES = [
  {
    id: 'phase1', title: 'Infrastructure & Connectivity', icon: 'fa-server', color: '#0ea5e9',
    tests: [
      { id: '1.1', name: 'SQL Server availability', how: 'Connect to DB host; run <code>SELECT @@VERSION</code>', pass: 'Returns SQL Server version string' },
      { id: '1.2', name: 'SDE connection file', how: 'Drag <code>sde@regional.sde</code> into ArcGIS Pro Connections', pass: 'Connects without error; feature classes listed' },
      { id: '1.3', name: 'UNC path access', how: 'Open <code>\\\\GIS\\Scripts\\NG911\\NG911_Automation\\connections\\</code>', pass: 'Path accessible; <code>.sde</code> files present' },
      { id: '1.4', name: 'Network share (Exports)', how: 'Open <code>\\\\GIS\\Scripts\\Geoshare\\NG911 Exports</code>', pass: 'Share exists; service account has R/W' },
      { id: '1.5', name: 'ArcGIS Portal reachability', how: 'Navigate to <code>https://apps.csrd.bc.ca/hub/home</code>', pass: 'Portal loads; login functional' },
      { id: '1.6', name: 'ArcGIS Server services', how: 'Server Manager → Services', pass: 'All NG911 services show <strong>Started</strong>' },
      { id: '1.7', name: 'Notebook Server health', how: 'Portal → Notebook item → Open', pass: 'Notebook opens; kernel starts' },
      { id: '1.8', name: 'Feature service REST endpoint', how: 'Hit <code>/query?where=1=1&resultRecordCount=1&f=json</code>', pass: 'Valid JSON with one feature' },
    ]
  },
  {
    id: 'phase2', title: 'Versioning Hierarchy', icon: 'fa-code-branch', color: '#8b5cf6',
    tests: [
      { id: '2.1', name: 'DEFAULT version exists', how: 'ArcGIS Pro → Versions pane', pass: '<code>sde.DEFAULT</code> present and accessible' },
      { id: '2.2', name: 'QA version exists', how: 'ArcGIS Pro → Versions pane', pass: '<code>SDE.QA</code> present, parent = DEFAULT' },
      { id: '2.3', name: 'All municipal versions exist', how: 'ArcGIS Pro → Versions pane', pass: 'CSRD, Salmon Arm, Sicamous, Golden, Revelstoke exist' },
      { id: '2.4', name: 'Version permissions', how: 'Right-click each version → Properties', pass: 'Municipal = Protected; QA/DEFAULT accessible' },
      { id: '2.5', name: 'No stale version locks', how: 'Versions pane → check lock icons', pass: 'No unexpected lock icons' },
      { id: '2.6', name: 'Geodatabase compression', how: 'Run Compress on the geodatabase', pass: 'Completes without errors' },
    ]
  },
  {
    id: 'phase3', title: 'Schema & Data Integrity', icon: 'fa-database', color: '#0d9488',
    tests: [
      { id: '3.1', name: 'Schema matches SSAP_Schema.json', how: 'Run QA GP tool — check schema output', pass: 'Zero mismatches' },
      { id: '3.2', name: 'Feature class exists', how: 'Query <code>SDE.NG911\\SDE.NG911_SiteAddress</code>', pass: 'Opens; returns record count' },
      { id: '3.3', name: 'All 61+ fields present', how: 'Compare field list vs Schema Guide', pass: 'All fields with correct types/lengths' },
      { id: '3.4', name: 'Coded value domains assigned', how: 'Catalog → Domains', pass: 'Domains exist and assigned correctly' },
      { id: '3.5', name: 'NGUID uniqueness', how: '<code>SELECT NGUID, COUNT(*) ... HAVING COUNT(*)>1</code>', pass: 'Zero rows returned' },
      { id: '3.6', name: 'Mandatory fields populated', how: 'Query where mandatory fields IS NULL', pass: 'Zero rows returned' },
      { id: '3.7', name: 'NGUID format valid', how: 'Query NGUIDs not matching URN pattern', pass: 'Zero invalid rows' },
      { id: '3.8', name: 'Spatial index present', how: 'Feature Class Properties → Indexes', pass: 'Spatial index listed and valid' },
    ]
  },
  {
    id: 'phase4', title: 'Attribute Rules (9 Arcade)', icon: 'fa-wand-magic-sparkles', color: '#f59e0b',
    tests: [
      { id: '4.1', name: 'PopulateFullAddress', how: 'Insert point with address components → save', pass: '<code>Full_Addr</code> concatenated correctly' },
      { id: '4.2', name: 'PopulateNGUID', how: 'Insert new point → save', pass: 'NGUID auto-populated as URN format' },
      { id: '4.3', name: 'Longitude', how: 'Insert/move point → save', pass: '<code>Long</code> = correct WGS84 decimal degrees' },
      { id: '4.4', name: 'Latitude', how: 'Insert/move point → save', pass: '<code>Lat</code> = correct WGS84 decimal degrees' },
      { id: '4.5', name: 'AddCode', how: 'Set <code>A3</code> to municipality → save', pass: 'Correct numeric code mapped' },
      { id: '4.6', name: 'DateUpdate', how: 'Edit any field → save', pass: 'Updated to current UTC timestamp' },
      { id: '4.7', name: 'QAStatus – Insert', how: 'Insert new point → save', pass: '<code>QAStatus</code> = Pending' },
      { id: '4.8', name: 'QAStatus – Field change', how: 'Modify Full_Addr → save', pass: 'QAStatus resets for re-validation' },
      { id: '4.9', name: 'Mandatory Constraint', how: 'Save with <code>Full_Addr</code> blank', pass: 'Save <strong>blocked</strong> with error' },
    ]
  },
  {
    id: 'phase5', title: 'Nightly Pipeline (5-Stage)', icon: 'fa-play-circle', color: '#0d9488',
    tests: [
      { id: '5.1', name: 'Trigger manual pipeline run', how: 'Orchestrator Notebook → Run All', pass: 'All 5 stages execute' },
      { id: '5.2', name: 'Stage 1: MUNI → QA', how: 'Pipeline logs / email', pass: 'Municipal versions reconciled to QA' },
      { id: '5.3', name: 'Stage 2: Run QA', how: 'Pipeline logs / email', pass: 'QAStatus updated; Features checked > 0' },
      { id: '5.4', name: 'Stage 3: QA → DEFAULT', how: 'Pipeline logs / email', pass: 'QA reconciled to DEFAULT' },
      { id: '5.5', name: 'Stage 4: Export FGDB', how: 'Check export network share', pass: 'ZIP with today\'s timestamp exists' },
      { id: '5.6', name: 'Stage 5: DEFAULT → MUNI', how: 'Pipeline logs / email', pass: 'DEFAULT reconciled back (NO_POST)' },
      { id: '5.7', name: 'Run summary JSON', how: 'Check <code>/arcgis/home/run_summaries/</code>', pass: 'JSON present with per-stage results' },
      { id: '5.8', name: 'Timeout protection config', how: 'Orchestrator notebook config', pass: 'Timeout = 1800 sec' },
    ]
  },
  {
    id: 'phase6', title: 'QA Validation Engine', icon: 'fa-clipboard-check', color: '#ef4444',
    tests: [
      { id: '6.1', name: 'Schema comparison check', how: 'Introduce temp mismatch → run QA', pass: 'Error reported; revert succeeds' },
      { id: '6.2', name: 'NGUID integrity', how: 'Validate known-valid dataset', pass: 'Zero NGUID errors' },
      { id: '6.3', name: 'Mandatory null detection', how: 'Leave mandatory field null → QA', pass: 'Feature flagged Failed' },
      { id: '6.4', name: 'Address duplicate detection', how: 'Insert duplicate Full_Addr → QA', pass: 'Warning (non-blocking)' },
      { id: '6.5', name: 'Smart row scoping', how: 'Touch 1 feature → run QA', pass: 'Only scoped features checked' },
    ]
  },
  {
    id: 'phase7', title: 'Export & Salmon Arm ETL', icon: 'fa-arrows-rotate', color: '#8b5cf6',
    tests: [
      { id: '7.1', name: 'FGDB creation', how: 'Run Export GP tool manually', pass: 'Scratch FGDB created with snapshot' },
      { id: '7.2', name: 'ZIP lock file handling', how: 'Check for .lock files in scratch', pass: 'No .lock in ZIP archive' },
      { id: '7.3', name: 'Network distribution', how: 'Verify ZIP on share', pass: 'Correct size; accessible' },
      { id: '7.4', name: 'SA source layer accessible', how: 'Hit Salmon Arm hosted service URL', pass: 'Valid JSON response' },
      { id: '7.5', name: 'SA dry run', how: 'Run ETL with <code>DRY_RUN = True</code>', pass: 'Reports without applying' },
      { id: '7.6', name: 'SA cascading match', how: 'Test NGUID → GlobalID → Featureid', pass: 'All 3 tiers match correctly' },
      { id: '7.7', name: 'SA reverse ID sync', how: '<code>REVERSE_ID_SYNC = True</code>', pass: 'IDs written back to source' },
      { id: '7.8', name: 'SA operation counts', how: 'Review sync email', pass: 'I/U/D counts match expected' },
    ]
  },
  {
    id: 'phase8', title: 'Notifications (Power Automate)', icon: 'fa-envelope', color: '#ec4899',
    tests: [
      { id: '8.1', name: 'Flow URL valid', how: 'Check orchestrator config', pass: 'URL points to active trigger' },
      { id: '8.2', name: 'Flow is enabled', how: 'Power Automate portal', pass: 'Status = On' },
      { id: '8.3', name: 'Success email', how: 'Run pipeline → check inbox', pass: 'PASSED badge, QA counters, stages' },
      { id: '8.4', name: 'Failure email', how: 'Force failure → run pipeline', pass: 'FAILED badge with error details' },
      { id: '8.5', name: 'SA sync email', how: 'Run ETL → check inbox', pass: 'Sync report with I/U/D breakdown' },
    ]
  },
  {
    id: 'phase9', title: 'Documentation Hub (SPA)', icon: 'fa-globe', color: '#0ea5e9',
    tests: [
      { id: '9.1', name: 'OAuth login flow', how: 'Open Doc Hub → sign in', pass: 'Authenticated; sidebar appears' },
      { id: '9.2', name: 'Admin RBAC visibility', how: 'Sign in as admin', pass: 'All nav cards; Maintenance visible' },
      { id: '9.3', name: 'Municipal RBAC isolation', how: 'Sign in as municipal user', pass: 'Only own guide; no cross-muni leaks' },
      { id: '9.4', name: 'All route hashes load', how: 'Navigate to each #hash', pass: 'Each partial loads; no 404s' },
      { id: '9.5', name: 'CMS content loads', how: 'Navigate pages after login', pass: 'Content from NG911_Docs_CMS table' },
      { id: '9.6', name: 'Admin CMS edit + save', how: 'Edit Mode → modify → Save Page', pass: 'Content saved; persists on refresh' },
      { id: '9.7', name: 'Search functionality', how: 'Search "NGUID" in doc search', pass: 'Relevant results; correct nav' },
    ]
  },
  {
    id: 'phase10', title: 'Operational Readiness', icon: 'fa-shield-halved', color: '#10b981',
    tests: [
      { id: '10.1', name: 'Scheduled task active', how: 'Portal → Notebook → Scheduled Tasks', pass: 'Nightly task enabled, correct cron' },
      { id: '10.2', name: 'SA sync schedule', how: 'Check ETL notebook task', pass: 'Enabled with correct frequency' },
      { id: '10.3', name: 'GDB maintenance trio', how: 'Compress → Rebuild Indexes → Analyze', pass: 'All three complete' },
      { id: '10.4', name: 'Disk space', how: 'Check export share drive', pass: '6+ months of free space' },
      { id: '10.5', name: 'SQL credentials', how: 'Verify SDE connection creds', pass: 'Non-expiring or date documented' },
      { id: '10.6', name: 'Power Automate expiry', how: 'Check connector renewal dates', pass: 'No connectors expiring in 90 days' },
      { id: '10.7', name: 'ArcGIS Pro licenses', how: 'Verify municipal license assignments', pass: 'All municipalities have valid licenses' },
      { id: '10.8', name: 'Portal user accounts', how: 'Review all municipal accounts', pass: 'Correct passwords, groups assigned' },
      { id: '10.9', name: 'Documentation deployed', how: 'Open Documentation Hub', pass: 'All pages; CMS renders; downloads work' },
      { id: '10.10', name: 'Backup & recovery', how: 'Verify SQL backup schedule', pass: 'Backups configured; recovery documented' },
    ]
  }
];

// ── State ──
function loadState() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; } catch { return {}; }
}
function saveState(state) { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }

// ── Counts ──
function getCounts() {
  const state = loadState();
  let total = 0, passed = 0, failed = 0, skipped = 0;
  PHASES.forEach(p => {
    p.tests.forEach(t => {
      total++;
      const s = state[t.id]?.status || 'pending';
      if (s === 'pass') passed++;
      else if (s === 'fail') failed++;
      else if (s === 'skip') skipped++;
    });
  });
  return { total, passed, failed, pending: total - passed - failed - skipped, skipped };
}

// ── Render ──
function render() {
  const state = loadState();
  const counts = getCounts();

  // Stats
  document.getElementById('stat-total').textContent = counts.total;
  document.getElementById('stat-passed').textContent = counts.passed;
  document.getElementById('stat-failed').textContent = counts.failed;
  document.getElementById('stat-pending').textContent = counts.pending;

  // Progress bar
  const pct = counts.total > 0 ? Math.round((counts.passed + counts.failed + counts.skipped) / counts.total * 100) : 0;
  document.getElementById('progress-bar').style.width = pct + '%';

  // Phases
  const wrap = document.getElementById('phases-container');
  wrap.innerHTML = '';
  PHASES.forEach(phase => {
    const phaseState = phase.tests.map(t => state[t.id]?.status || 'pending');
    const done = phaseState.filter(s => s !== 'pending').length;
    const phasePct = Math.round(done / phase.tests.length * 100);

    let html = `
      <div class="phase-section">
        <div class="phase-header" onclick="this.classList.toggle('open')">
          <div class="phase-icon" style="background:${phase.color}"><i class="fas ${phase.icon}"></i></div>
          <div class="phase-title-wrap">
            <div class="phase-title">${phase.title}</div>
            <div class="phase-subtitle">${phase.tests.length} tests · ${done} completed</div>
          </div>
          <div class="phase-progress">
            <div class="phase-progress-bar"><div class="phase-progress-fill" style="width:${phasePct}%"></div></div>
            <div class="phase-progress-text">${phasePct}%</div>
          </div>
          <i class="fas fa-chevron-down phase-chevron"></i>
        </div>
        <div class="phase-body">
          <table class="test-table">
            <thead><tr><th>#</th><th>Test</th><th>How to Verify</th><th>Pass Criteria</th><th>Status</th><th>Notes</th></tr></thead>
            <tbody>`;

    phase.tests.forEach(t => {
      const ts = state[t.id] || {};
      const st = ts.status || 'pending';
      const notes = ts.notes || '';
      html += `<tr>
        <td>${t.id}</td>
        <td>${t.name}</td>
        <td>${t.how}</td>
        <td>${t.pass}</td>
        <td><select class="status-select status-${st}" onchange="updateStatus('${t.id}',this.value)" data-tid="${t.id}">
          <option value="pending" ${st==='pending'?'selected':''}>⏳ Pending</option>
          <option value="pass" ${st==='pass'?'selected':''}>✅ Pass</option>
          <option value="fail" ${st==='fail'?'selected':''}>❌ Fail</option>
          <option value="skip" ${st==='skip'?'selected':''}>⏭ Skip</option>
        </select></td>
        <td><textarea class="notes-input" placeholder="Add notes..." onblur="updateNotes('${t.id}',this.value)" rows="1">${notes}</textarea></td>
      </tr>`;
    });
    html += '</tbody></table></div></div>';
    wrap.innerHTML += html;
  });
}

function updateStatus(id, val) {
  const state = loadState();
  if (!state[id]) state[id] = {};
  state[id].status = val;
  saveState(state);
  render();
}

function updateNotes(id, val) {
  const state = loadState();
  if (!state[id]) state[id] = {};
  state[id].notes = val;
  saveState(state);
}

function resetAll() {
  if (confirm('Reset ALL test results? This cannot be undone.')) {
    localStorage.removeItem(STORAGE_KEY);
    render();
  }
}

function expandAll() {
  document.querySelectorAll('.phase-header').forEach(h => h.classList.add('open'));
}

function collapseAll() {
  document.querySelectorAll('.phase-header').forEach(h => h.classList.remove('open'));
}

function exportJSON() {
  const state = loadState();
  const blob = new Blob([JSON.stringify({ exportDate: new Date().toISOString(), results: state }, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `NG911_TestResults_${new Date().toISOString().slice(0,10)}.json`;
  a.click();
}

function importJSON() {
  const input = document.createElement('input');
  input.type = 'file'; input.accept = '.json';
  input.onchange = e => {
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const data = JSON.parse(ev.target.result);
        saveState(data.results || data);
        render();
      } catch { alert('Invalid JSON file.'); }
    };
    reader.readAsText(e.target.files[0]);
  };
  input.click();
}

// Init
document.addEventListener('DOMContentLoaded', render);
