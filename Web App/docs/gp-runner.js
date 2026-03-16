import { auth } from './auth.js?v=3';
import { config } from './config.js';

export async function initGPRunner(hash) {
    if (!auth.isAdmin || !auth.isAdmin()) return;

    let gpBaseUrl = '';
    let containerSelector = '';
    
    if (hash === 'script-qa') {
        gpBaseUrl = config.gpTools.qaValidation;
        containerSelector = '#fullsrc-script-qa';
    } else if (hash === 'script-reconcile') {
        gpBaseUrl = config.gpTools.reconcilePost;
        containerSelector = '#fullsrc-script-reconcile';
    } else if (hash === 'script-export') {
        gpBaseUrl = config.gpTools.exportSsap;
        containerSelector = '#fullsrc-script-export';
    } else {
        return;
    }

    const container = document.querySelector(containerSelector);
    if (!container) return;

    // Create Runner UI container
    const runnerDiv = document.createElement('div');
    runnerDiv.className = 'card reveal visible admin-only-block';
    runnerDiv.style.marginTop = '20px';
    runnerDiv.style.border = '1px solid var(--accent)';
    runnerDiv.innerHTML = `
        <div class="card-header">
            <div class="card-icon" style="background:var(--accent)"><i class="fas fa-terminal"></i></div>
            <h4>Execute GP Tool</h4>
            <span class="card-tag" style="background:var(--red);color:white">Admin Execution</span>
        </div>
        <details>
            <summary style="padding: 15px; cursor: pointer; font-weight: bold; background: rgba(0,0,0,0.1); border-bottom: 1px solid rgba(255,255,255,0.05);">
                <i class="fas fa-chevron-right details-icon"></i> Parameter Configuration (Click to Expand)
            </summary>
            <div id="gp-form-container" style="padding: 15px;">
                <i class="fas fa-spinner fa-spin"></i> Loading parameters from ArcGIS Server...
            </div>
            <div id="gp-result-container" style="margin: 0 15px 15px 15px; display:none; background: #0f172a; color: #00ff00; padding: 15px; border-radius: 6px; font-family: monospace; white-space: pre-wrap; font-size: 0.85rem; max-height: 400px; overflow-y: auto;"></div>
        </details>
    `;
    
    // Insert after the source code block
    container.parentNode.insertBefore(runnerDiv, container.nextSibling);

    try {
        const token = auth.getToken();
        
        // Step 1: Fetch the GP Service root to find its Task name
        const serviceReq = await fetch(`${gpBaseUrl}?f=json&token=${token}`);
        const serviceDef = await serviceReq.json();

        if (serviceDef.error) {
            throw new Error(serviceDef.error.message);
        }

        if (!serviceDef.tasks || serviceDef.tasks.length === 0) {
            throw new Error("No tasks found published in this GP Service.");
        }

        const taskName = serviceDef.tasks[0];
        const gpTaskUrl = `${gpBaseUrl}/${taskName}`;

        // Step 2: Fetch the specific Task definition to get its parameters
        const taskReq = await fetch(`${gpTaskUrl}?f=json&token=${token}`);
        const taskDef = await taskReq.json();

        if (taskDef.error) {
            throw new Error(taskDef.error.message);
        }

        // Nightly Orchestrator Defaults Override
        const defaultOverrides = {
            'QAAutomationScriptTool': {
                'target_layer': 'SDE.NG911\\SDE.NG911_SiteAddress',
                'schema_json': '\\\\GIS\\Scripts\\NG911\\NG911_Automation\\SSAP_Schema.json',
                'mode': 'all',
                'check_types': true,
                'check_lengths': true,
                'check_nguid_format': false,
                'normalize_nguid': true,
                'mandatory_fields': 'DiscrpAgID;DateUpdate;NGUID;Country;A3;A2;A1',
                'address_dup_field': 'Full_Addr',
                'address_dup_max_rows': 5000,
                'qa_status_field': 'QAStatus',
                'update_qa_status': true,
                'out_log_folder': '/arcgis/home/run_summaries'
            },
            'ReconcilePostTraditional': {
                'sde_conn': '\\\\GIS\\Scripts\\NG911\\NG911_Automation\\connections\\sde@regional.sde',
                'qa_version': 'SDE.QA',
                'default_version': 'sde.DEFAULT',
                'editor_versions': 'SDE.CSRD;SDE.Revelstoke;SDE.Golden;SDE.Salmon Arm;SDE.Sicamous',
                'out_log_folder': '/arcgis/home/run_summaries',
                'conflict_policy': 'NO_ABORT',
                'acquire_locks': 'LOCK_ACQUIRED'
            },
            'ExportEnterpriseToFileGDB': {
                'sde_conn': '\\\\GIS\\Scripts\\NG911\\NG911_Automation\\connections\\sde@regional.sde',
                'target_fc': 'SDE.NG911\\SDE.NG911_SiteAddress',
                'name_prefix': 'SSAP_Default'
            }
        };

        const taskOverrides = defaultOverrides[taskName] || {};

        // Build Form
        let formHtml = `<form id="gp-execute-form" style="display:flex; flex-direction:column; gap:10px;">`;
        
        const params = taskDef.parameters || [];
        const inputParams = params.filter(p => p.direction === 'esriGPParameterDirectionInput');

        inputParams.forEach(p => {
            const requiredMarker = p.parameterType === 'esriGPParameterTypeRequired' ? '<span style="color:red">*</span>' : '';
            
            // Check overrides first, then service defaults
            let defaultVal = '';
            if (taskOverrides[p.name] !== undefined) {
                defaultVal = taskOverrides[p.name];
            } else if (p.defaultValue !== undefined && p.defaultValue !== null) {
                defaultVal = p.defaultValue;
            }
            
            formHtml += `<div style="display:flex; flex-direction:column; gap:4px;">
                <label style="font-size:0.85rem; font-weight:600; color:var(--text-secondary)">
                    ${p.displayName} <i class="fas fa-question-circle" style="color:var(--accent); margin-left:4px;" title="Internal Name: ${p.name} | Type: ${p.dataType}"></i> ${requiredMarker}
                </label>`;
            
            if (p.choiceList && p.choiceList.length > 0) {
                formHtml += `<select name="${p.name}" class="form-control" style="padding:8px; border-radius:4px; border:1px solid rgba(255,255,255,0.1); background:rgba(0,0,0,0.2); color:white;">`;
                p.choiceList.forEach(choice => {
                    const sel = (choice === defaultVal) ? 'selected' : '';
                    formHtml += `<option value="${choice}" ${sel}>${choice}</option>`;
                });
                formHtml += `</select>`;
            } else if (p.dataType === 'GPBoolean') {
                const checked = (defaultVal === true || defaultVal === 'true') ? 'checked' : '';
                formHtml += `<div><input type="checkbox" name="${p.name}" value="true" ${checked}></div>`;
            } else {
                formHtml += `<input type="text" name="${p.name}" value="${defaultVal}" class="form-control" style="padding:8px; border-radius:4px; border:1px solid rgba(255,255,255,0.1); background:rgba(0,0,0,0.2); color:white; width:100%;">`;
            }
            formHtml += `</div>`;
        });

        formHtml += `<button type="submit" class="btn" style="margin-top:15px; background:var(--accent); color:white; border:none; padding:10px; border-radius:4px; font-weight:bold; cursor:pointer; width: max-content;"><i class="fas fa-play"></i> Submit Job</button>`;
        formHtml += `</form>`;

        document.getElementById('gp-form-container').innerHTML = formHtml;

        // Handle Submit
        document.getElementById('gp-execute-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = e.target.querySelector('button[type="submit"]');
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting...';
            btn.disabled = true;

            const resDiv = document.getElementById('gp-result-container');
            resDiv.style.display = 'block';
            resDiv.innerHTML = 'Submitting job via REST API...\n';

            // Build structured payload, intercepting File parameters and Checkboxes
            const payload = new FormData();
            payload.append('f', 'json');
            payload.append('token', token);
            
            inputParams.forEach(p => {
                const el = e.target.elements[p.name];
                if (!el) return;

                if (p.dataType === 'GPBoolean') {
                    payload.append(p.name, el.checked ? 'true' : 'false');
                } else if (['GPDataFile', 'DEFile'].includes(p.dataType) || p.name === 'sde_conn' || p.name === 'schema_json') {
                    // ArcGIS REST requires {"url": "\\path"} JSON structuring for network paths instead of raw strings
                    const val = el.value.trim();
                    if (val.startsWith('\\\\')) {
                        payload.append(p.name, JSON.stringify({ url: val }));
                    } else {
                        payload.append(p.name, val); // Fallback if it's somehow not a UNC path
                    }
                } else {
                    payload.append(p.name, el.value);
                }
            });

            try {
                // Submit Asynchronous Job
                const submitReq = await fetch(`${gpTaskUrl}/submitJob`, {
                    method: 'POST',
                    body: payload
                });
                const submitRes = await submitReq.json();

                if (submitRes.error) {
                    throw new Error(submitRes.error.message);
                }

                const jobId = submitRes.jobId;
                resDiv.innerHTML += `Job ID Assigned: ${jobId}\nPolling status...\n\n`;

                // Poll Job Status every 3 seconds
                const pollInterval = setInterval(async () => {
                    try {
                        const statusReq = await fetch(`${gpTaskUrl}/jobs/${jobId}?f=json&token=${token}`);
                        const statusRes = await statusReq.json();

                        resDiv.innerHTML = `Job ID: ${jobId}\nLatest Status: ${statusRes.jobStatus}\n\n`;
                        
                        if (statusRes.messages && statusRes.messages.length > 0) {
                             const msgs = statusRes.messages.map(m => `[${m.type.replace('esriJobMessageType', '')}] ${m.description}`).join('\n');
                             resDiv.innerHTML += msgs + '\n';
                        }

                        if (['esriJobSucceeded', 'esriJobFailed', 'esriJobCancelled'].includes(statusRes.jobStatus)) {
                            clearInterval(pollInterval);
                            btn.innerHTML = '<i class="fas fa-play"></i> Submit Job';
                            btn.disabled = false;
                            
                            // If succeeded, fetch the derived outputs
                            if (statusRes.jobStatus === 'esriJobSucceeded') {
                                resDiv.innerHTML += `\n[System] Job completed successfully. Fetching outputs...\n`;
                                const outParam = params.find(p => p.direction !== 'esriGPParameterDirectionInput');
                                if (outParam) {
                                    const resReq = await fetch(`${gpTaskUrl}/jobs/${jobId}/results/${outParam.name}?f=json&token=${token}`);
                                    const resData = await resReq.json();
                                    resDiv.innerHTML += `\nOutput (${outParam.name}):\n${JSON.stringify(resData.value, null, 2)}`;
                                }
                            }
                        }
                    } catch(pollErr) {
                        clearInterval(pollInterval);
                        resDiv.innerHTML += `\nPolling Error: ${pollErr.message}`;
                        btn.innerHTML = '<i class="fas fa-play"></i> Submit Job';
                        btn.disabled = false;
                    }
                }, 3000);

            } catch(submitErr) {
                resDiv.innerHTML += `\nSubmission Error: ${submitErr.message}`;
                btn.innerHTML = '<i class="fas fa-play"></i> Submit Job';
                btn.disabled = false;
            }
        });

    } catch(err) {
        document.getElementById('gp-form-container').innerHTML = `<p style="color:var(--red)"><i class="fas fa-exclamation-triangle"></i> Authentication or Request Error: ${err.message}</p>`;
    }
}
