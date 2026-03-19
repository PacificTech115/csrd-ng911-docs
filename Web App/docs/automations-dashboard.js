import { auth } from './auth.js?v=3';
import { config } from './config.js?v=3';

export const initAutomationsDashboard = () => {
  const formatTime = (isoString) => {
    if (!isoString) return '--';
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return d.toLocaleString();
  };

  const setStatusChip = (elementId, statusText, isSuccess) => {
    const el = document.getElementById(elementId);
    if (!el) return;
    
    // Status text logic (success, success_qa_warnings count as passed/warnings)
    let bg = 'rgba(148, 163, 184, 0.1)';
    let color = 'var(--text-secondary)';
    let icon = 'fa-info-circle';

    if (isSuccess === true || statusText === 'success') {
      bg = 'rgba(16, 185, 129, 0.1)';
      color = 'var(--green)';
      icon = 'fa-check-circle';
    } else if (statusText === 'success_qa_warnings') {
      bg = 'rgba(245, 158, 11, 0.1)';
      color = '#d97706'; // amber
      icon = 'fa-exclamation-triangle';
    } else if (isSuccess === false || statusText?.includes('fail')) {
      bg = 'rgba(239, 68, 68, 0.1)';
      color = 'var(--red)';
      icon = 'fa-times-circle';
    }

    el.style.background = bg;
    el.style.color = color;
    el.innerHTML = `<i class="fas ${icon}"></i> ${statusText || (isSuccess ? 'Success' : 'Failed')}`;
  };

  const basePath = window.location.pathname.includes('/docs/') ? '../' : '';

  const fetchNightly = async () => {
    try {
      // Pull from the Base64 CMS Cache instead of static files
      const cmsKey = 'dashboard.orchestrator.latest_run';
      const row = window.cms?.cache?.[cmsKey];
      if (!row || !row[window.cms.fieldMap.content]) throw new Error(`MISSING_CMS:${cmsKey}`);
      
      let rawData = row[window.cms.fieldMap.content];
      if (rawData && rawData.match(/^[A-Za-z0-9+/=]+$/)) {
         rawData = decodeURIComponent(escape(atob(rawData)));
      }
      const data = JSON.parse(rawData);
      
      document.getElementById('nightly-start').textContent = formatTime(data.started);
      document.getElementById('nightly-finish').textContent = formatTime(data.finished);
      setStatusChip('nightly-status-chip', data.status, null);

      const stagesContainer = document.getElementById('nightly-stages');
      stagesContainer.innerHTML = '';
      
      if (data.stage_summaries && data.stage_summaries.length > 0) {
        let detailsHtml = `
          <details style="cursor:pointer; outline: none;">
            <summary style="font-weight:600; color:var(--navy); padding:8px 0; user-select:none; font-size:0.95rem;">
              <i class="fas fa-chevron-circle-down" style="margin-right:6px; color:var(--teal);"></i> View Detailed Run Info
            </summary>
            <div style="margin-top:12px; display:flex; flex-direction:column; gap:12px;">
              
              <!-- Raw Payload Metadata -->
              <div style="font-family: monospace; font-size: 0.8rem; background:rgba(0,0,0,0.03); padding:10px; border-radius:6px; overflow-x:auto; line-height: 1.5;">
                <strong style="color:var(--navy)">Run ID:</strong> ${data.run_id || '--'} <br>
                <strong style="color:var(--navy)">Invoked By:</strong> ${data.user || '--'} <br>
                <strong style="color:var(--navy)">Output Artifacts:</strong> ${data.output_files && data.output_files.length > 0 ? data.output_files.map(f => {
                  const pathStr = typeof f === 'string' ? f : (f.path || '');
                  return pathStr.split('\\').pop() || pathStr.split('/').pop();
                }).join(', ') : 'None'}
              </div>
        `;
        
        data.stage_summaries.forEach(stage => {
          const icon = stage.success ? '<i class="fas fa-check" style="color:var(--green)"></i>' : '<i class="fas fa-times" style="color:var(--red)"></i>';
          detailsHtml += `
            <div style="display: flex; gap: 12px; align-items:flex-start; font-size: 0.9rem; padding: 12px; background: rgba(0,0,0,0.02); border-radius: 6px;">
              <div style="margin-top:2px;">${icon}</div>
              <div style="flex: 1;">
                <div style="font-weight: 600; color: var(--navy); margin-bottom: 4px;">${stage.stage}</div>
                <div style="color: var(--text-secondary); line-height: 1.4;">${stage.summary || ''}</div>
              </div>
            </div>
          `;
        });
        
        detailsHtml += `</div></details>`;
        stagesContainer.innerHTML = detailsHtml;
      } else {
        stagesContainer.innerHTML = '<div style="color:var(--text-secondary);font-size:0.9rem;">No stage data available.</div>';
      }
    } catch (e) {
      if (e.message && e.message.includes('MISSING_CMS')) {
        document.getElementById('nightly-status-chip').innerHTML = '<i class="fas fa-hourglass-start"></i> Awaiting First Run';
        document.getElementById('nightly-status-chip').style.color = 'var(--text-secondary)';
        document.getElementById('nightly-start').textContent = '--';
        document.getElementById('nightly-finish').textContent = '--';
        document.getElementById('nightly-stages').innerHTML = '<div style="color:var(--text-secondary);font-size:0.9rem;">No data available until the pipeline runs successfully.</div>';
      } else {
        document.getElementById('nightly-status-chip').innerHTML = '<i class="fas fa-exclamation-circle"></i> Error loading data';
        document.getElementById('nightly-status-chip').style.color = 'var(--red)';
        console.error(e);
      }
    }

    // Inject Run Button for Admins (Render regardless of JSON status)
    if (auth.isAdmin()) {
      const runBtnContainer = document.getElementById('nightlyRunBtnContainer');
      if (runBtnContainer) {
        const nightlyGpUrl = config.gpTools.orchestrator;
        runBtnContainer.innerHTML = `
          <button id="runNightlyBtn" data-action="run-notebook" data-pipeline="nightly" data-itemid="${nightlyGpUrl}" class="btn primary" data-editor-bypass="true" style="margin-top: 15px; width: 100%; justify-content: center; background: var(--navy); color: white; border: none; padding: 12px; border-radius: 8px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 8px;">
            <i class="fas fa-play"></i> Force Run Pipeline
          </button>
        `;
      }
    }
  };

  const fetchETL = async () => {
    try {
      const cmsKey = 'dashboard.etl.latest_run';
      const row = window.cms?.cache?.[cmsKey];
      if (!row || !row[window.cms.fieldMap.content]) throw new Error(`MISSING_CMS:${cmsKey}`);
      
      let rawData = row[window.cms.fieldMap.content];
      if (rawData && rawData.match(/^[A-Za-z0-9+/=]+$/)) {
         rawData = decodeURIComponent(escape(atob(rawData)));
      }
      const data = JSON.parse(rawData);
      
      document.getElementById('etl-start').textContent = formatTime(data.timestamp);
      // ETL doesn't write 'finished' explicitly in the root in ETL right now, but writes to timestamp.
      // We can just rely on the power automate timestamp or just leave finish empty.
      document.getElementById('etl-finish').textContent = '--';
      setStatusChip('etl-status-chip', data.success ? 'Success' : 'Failed', data.success);

      const statsContainer = document.getElementById('etl-stats');
      statsContainer.innerHTML = '';
      
      const planned = data.planned || {};
      const applied = data.applied || {};
      
      const statRow = (label, plannedVal, appliedVal) => `
        <div style="display: flex; justify-content: space-between; font-size: 0.95rem; padding: 8px 0; border-bottom: 1px dashed rgba(0,0,0,0.1);">
          <span style="color: var(--text-secondary); font-weight: 500;">${label}</span>
          <span style="font-weight: 600; color: var(--navy);">${appliedVal || 0} / ${plannedVal || 0}</span>
        </div>
      `;

      let detailsHtml = `
        <details style="cursor:pointer; outline: none;">
          <summary style="font-weight:600; color:var(--navy); padding:8px 0; user-select:none; font-size:0.95rem;">
            <i class="fas fa-chevron-circle-down" style="margin-right:6px; color:var(--teal);"></i> View Detailed Sync Info
          </summary>
          <div style="margin-top:12px; display:flex; flex-direction:column; gap:12px;">
            
            <div style="font-family: monospace; font-size: 0.8rem; background:rgba(0,0,0,0.03); padding:10px; border-radius:6px; overflow-x:auto; line-height: 1.5;">
              <strong style="color:var(--navy)">Feature Class:</strong> ${data.feature_class || '--'} <br>
              <strong style="color:var(--navy)">Run Time:</strong> ${data.run_time_seconds ? `${data.run_time_seconds.toFixed(2)}s` : '--'} <br>
              <strong style="color:var(--navy)">Power Automate URL Key:</strong> ${data.power_automate_url ? data.power_automate_url.substring(0, 30) + '...' : 'None'}
            </div>

            <div style="padding: 12px; background: rgba(0,0,0,0.02); border-radius: 6px;">
              <div style="font-weight: 600; color: var(--navy); margin-bottom: 8px; font-size: 0.95rem;">Operations (Applied / Planned)</div>
              ${statRow('Inserts', planned.inserts, applied.adds)}
              ${statRow('Updates', planned.updates, applied.updates)}
              ${statRow('Deletes', planned.deletes, applied.deletes)}
            </div>
      `;
      
      if (data.failure_count > 0) {
        detailsHtml += `
          <div style="color: var(--red); font-size: 0.85rem; margin-top: 4px; background: rgba(239, 68, 68, 0.1); padding: 10px; border-radius: 6px;">
            <i class="fas fa-exclamation-triangle"></i> Encountered ${data.failure_count} failures during sync.
          </div>
        `;
      }
      
      detailsHtml += `</div></details>`;
      statsContainer.innerHTML = detailsHtml;
    } catch (e) {
      if (e.message && e.message.includes('MISSING_CMS')) {
        document.getElementById('etl-status-chip').innerHTML = '<i class="fas fa-hourglass-start"></i> Awaiting First Run';
        document.getElementById('etl-status-chip').style.color = 'var(--text-secondary)';
        document.getElementById('etl-start').textContent = '--';
        document.getElementById('etl-finish').textContent = '--';
        document.getElementById('etl-stats').innerHTML = '<div style="color:var(--text-secondary);font-size:0.9rem;">No data available until the sync runs successfully.</div>';
      } else {
        document.getElementById('etl-status-chip').innerHTML = '<i class="fas fa-exclamation-circle"></i> Error loading data';
        document.getElementById('etl-status-chip').style.color = 'var(--red)';
        console.error(e);
      }
    }

    // Inject Run Button for Admins (Render regardless of JSON status)
    if (auth.isAdmin()) {
      const runBtnContainer = document.getElementById('etlRunBtnContainer');
      if (runBtnContainer) {
        runBtnContainer.innerHTML = `
          <button id="runEtlBtn" data-action="run-notebook" data-pipeline="etl" data-itemid="${config.notebooks.salmonArmETLId}" class="btn primary" data-editor-bypass="true" style="margin-top: 15px; width: 100%; justify-content: center; background: var(--navy); color: white; border: none; padding: 12px; border-radius: 8px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 8px;">
            <i class="fas fa-play"></i> Force Run Sync
          </button>
        `;
      }
    }
  };

  const loadAll = async () => {
    // reset UI to loading
    ['nightly-status-chip', 'etl-status-chip'].forEach(id => {
      const el = document.getElementById(id);
      if(el) {
        el.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';
        el.style.background = 'rgba(148, 163, 184, 0.1)';
        el.style.color = 'var(--text-secondary)';
      }
    });

    // Force a fresh fetch from the CMS so we don't read stale memory cache
    if (window.cms && typeof window.cms.fetchAllContent === 'function') {
        await window.cms.fetchAllContent();
    }
    
    await Promise.all([
      fetchNightly(),
      fetchETL()
    ]);
  };
  
  const refreshBtn = document.getElementById('refresh-dashboard');
  if (refreshBtn) {
      // Remove old listeners to prevent stacking
      const newBtn = refreshBtn.cloneNode(true);
      refreshBtn.parentNode.replaceChild(newBtn, refreshBtn);
      newBtn.addEventListener('click', loadAll);
  }

  // --- Geoprocessing Execution Logic ---
  const triggerNotebookRun = async (pipelineName, gpUrl, btnId) => {
    const btn = document.getElementById(btnId);
    if (!btn) {
        alert("Failed to find button element!");
        return;
    }
    
    const originalText = btn.innerHTML;
    const token = auth.getToken();
    
    if (!token) {
        alert("Authentication context lost. Please refresh the page.");
        return;
    }

    if (!confirm(`Are you sure you want to manually trigger the ${pipelineName} pipeline? This action cannot be reversed.`)) {
        return;
    }

    try {
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting...';
        btn.disabled = true;
        btn.style.opacity = '0.7';
        btn.style.cursor = 'not-allowed';

        // 1. Submit the Job
        const submitUrl = `${gpUrl}/submitJob`;
        const params = new URLSearchParams();
        params.append('f', 'json');
        params.append('token', token);
        
        const submitRes = await fetch(submitUrl, {
            method: 'POST',
            body: params
        });
        
        const submitData = await submitRes.json();
        
        if (submitData.error) throw new Error(submitData.error.message);
        if (!submitData.jobId) throw new Error("No Job ID returned from GP Server.");
        
        const jobId = submitData.jobId;
        console.log(`Submitted Geoprocessing Job. JobId: ${jobId}`);
        
        // 2. Poll the Job Status
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Running...';
        
        const pollInterval = setInterval(async () => {
            try {
                const statusUrl = `${gpUrl}/jobs/${jobId}?f=json&token=${token}`;
                const statusRes = await fetch(statusUrl);
                const statusData = await statusRes.json();
                
                console.log(`Job status: ${statusData.jobStatus}`);
                
                if (statusData.jobStatus === 'esriJobSucceeded') {
                    clearInterval(pollInterval);
                    btn.innerHTML = '<i class="fas fa-check"></i> Complete';
                    btn.style.background = 'var(--green)';
                    
                    // Delay and refresh the dashboard to fetch the new run_summaries static output
                    setTimeout(() => {
                        fetchNightly();
                        fetchETL();
                        resetButton(btn, originalText);
                    }, 3000);
                    
                } else if (statusData.jobStatus === 'esriJobFailed') {
                    clearInterval(pollInterval);
                    btn.innerHTML = '<i class="fas fa-times"></i> Failed';
                    btn.style.background = 'var(--red)';
                    console.error("Geoprocessing execution failed:", statusData);
                    alert(`The pipeline execution failed. Please check the ArcGIS Server logs for Job ID: ${jobId}`);
                    setTimeout(() => resetButton(btn, originalText), 5000);
                } 
                // esriJobSubmitted, esriJobExecuting -> keep polling
                
            } catch (pollErr) {
                console.error("Error polling job status:", pollErr);
            }
        }, 5000); // Poll every 5 seconds

    } catch (e) {
        console.error("Failed to execute notebook:", e);
        alert(`Failed to execute pipeline: ${e.message}`);
        resetButton(btn, originalText);
    }
  };

  const resetButton = (btn, originalText) => {
      btn.innerHTML = originalText;
      btn.disabled = false;
      btn.style.opacity = '1';
      btn.style.cursor = 'pointer';
      btn.style.background = 'var(--navy)';
  };

  // Event Delegation for dynamic buttons
  if (!window.dashboardClickListenerAdded) {
    document.body.addEventListener('click', (e) => {
        const targetBtn = e.target.closest('[data-action="run-notebook"]');
        if (targetBtn) {
            e.preventDefault();
            const pipeline = targetBtn.getAttribute('data-pipeline');
            const item = targetBtn.getAttribute('data-itemid');
            const btnId = targetBtn.id;
            
            try {
                triggerNotebookRun(pipeline, item, btnId);
            } catch (err) {
                alert("UI Error clicking button: " + err.message);
                console.error(err);
            }
        }
    });
    window.dashboardClickListenerAdded = true;
  }

  // Initial load
  loadAll();
};
