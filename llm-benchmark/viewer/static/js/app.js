        // State management
        let leaderboardData = null;
        let currentModel = null;
        let currentModelRuns = [];

        // Navigation state
        let navigationHistory = []; // Stack of {view: string, data: object}
        let currentView = {view: 'home', data: {}};

        // Client-side cache for bulk data
        let dataCache = {
            runs: {}, // run_id -> bulk data
            currentRunId: null,
            currentModelName: null
        };

        // Async operations tracker
        let activeOperations = new Map(); // operation_id -> {type, status, startTime}
        let operationCounter = 0;

        // Model display names mapping (friendly names)
        let modelDisplayNames = {};

        // Utility function to get display name for a model
        function getModelDisplayName(modelName) {
            return modelDisplayNames[modelName] || modelName;
        }

        // Fetch model display names from config
        async function loadModelDisplayNames() {
            try {
                const response = await fetch('/api/model-display-names');
                if (response.ok) {
                    const data = await response.json();
                    modelDisplayNames = data.model_display_names || {};
                    console.log('Model display names loaded:', Object.keys(modelDisplayNames).length);
                } else {
                    console.warn('Failed to load model display names, using full names');
                }
            } catch (error) {
                console.warn('Error loading model display names:', error);
            }
        }

        // Navigation functions
        function updateNavigation() {
            const backBtn = document.getElementById('backBtn');
            const homeBtn = document.getElementById('homeBtn');

            // Safety check - elements might not exist yet
            if (!backBtn || !homeBtn) {
                console.warn('Navigation buttons not found in DOM yet');
                return;
            }

            // Show back button if we have history
            if (navigationHistory.length > 0) {
                backBtn.style.display = 'block';
            } else {
                backBtn.style.display = 'none';
            }

            // Show home button if we're not on home
            if (currentView.view !== 'home') {
                homeBtn.style.display = 'block';
            } else {
                homeBtn.style.display = 'none';
            }
        }

        function pushNavigation(view, data) {
            // Push current view to history
            navigationHistory.push({...currentView});
            currentView = {view, data};
            updateNavigation();
        }

        function goBack() {
            if (navigationHistory.length === 0) return;

            // Pop from history
            const previousView = navigationHistory.pop();
            currentView = previousView;
            updateNavigation();

            // Navigate to previous view
            if (previousView.view === 'home') {
                loadUnifiedLeaderboard();
            } else if (previousView.view === 'model-details') {
                viewModelDetailsForRun(previousView.data.modelName, previousView.data.runId);
            } else if (previousView.view === 'response') {
                viewResponse(previousView.data.modelName, previousView.data.questionId, previousView.data.runId);
            }
        }

        function refreshCurrentView() {
            // Refresh whatever view we're currently on
            if (currentView.view === 'home') {
                loadUnifiedLeaderboard();
            } else if (currentView.view === 'model-details') {
                // Force refresh by clearing cache
                const cacheKey = `${currentView.data.runId}_${currentView.data.modelName}`;
                delete dataCache.runs[cacheKey];
                viewModelDetailsForRun(currentView.data.modelName, currentView.data.runId);
            } else if (currentView.view === 'response') {
                // Force refresh by clearing cache
                const cacheKey = `${currentView.data.runId}_${currentView.data.modelName}`;
                delete dataCache.runs[cacheKey];
                viewResponse(currentView.data.modelName, currentView.data.questionId, currentView.data.runId);
            }
        }

        // Initialize
        document.addEventListener('DOMContentLoaded', async () => {
            console.log('DOM loaded, initializing...');
            try {
                // Load model display names first
                await loadModelDisplayNames();
                await loadUnifiedLeaderboard();
                console.log('Leaderboard loaded successfully');
            } catch (error) {
                console.error('Fatal error during initialization:', error);
                document.getElementById('loadingMessage').style.display = 'none';
                document.getElementById('mainContent').style.display = 'block';
                document.getElementById('mainContent').innerHTML = '<div style="background: var(--danger-bg); border: 1px solid var(--danger); border-radius: 8px; padding: 2rem; margin: 2rem;"><h2>❌ Error</h2><p>Failed to initialize: ' + error.message + '</p><p>Check the browser console for details.</p></div>';
            }
        });

        // Async operations and notifications
        function startOperation(type, description) {
            const opId = ++operationCounter;
            activeOperations.set(opId, {
                type,
                description,
                status: 'running',
                startTime: Date.now()
            });
            updateOperationsDisplay();
            return opId;
        }

        function completeOperation(opId, success = true, message = null) {
            const op = activeOperations.get(opId);
            if (op) {
                op.status = success ? 'success' : 'error';
                op.endTime = Date.now();
                op.message = message;
                updateOperationsDisplay();
                // Remove after 3 seconds
                setTimeout(() => {
                    activeOperations.delete(opId);
                    updateOperationsDisplay();
                }, 3000);
            }
        }

        function updateOperationsDisplay() {
            let existingContainer = document.getElementById('operations-container');
            if (!existingContainer) {
                existingContainer = document.createElement('div');
                existingContainer.id = 'operations-container';
                existingContainer.style.cssText = 'position: fixed; top: 80px; right: 20px; z-index: 1000; max-width: 400px;';
                document.body.appendChild(existingContainer);
            }

            let html = '';
            for (const [opId, op] of activeOperations.entries()) {
                const duration = op.endTime ? (op.endTime - op.startTime) / 1000 : (Date.now() - op.startTime) / 1000;
                const statusColor = op.status === 'running' ? 'var(--info)' : op.status === 'success' ? 'var(--success)' : 'var(--danger)';
                const statusIcon = op.status === 'running' ? '⏳' : op.status === 'success' ? '✓' : '✗';

                html += `<div style="background: var(--bg-secondary); border: 1px solid ${statusColor}; border-left: 4px solid ${statusColor}; border-radius: 8px; padding: 1rem; margin-bottom: 0.5rem; box-shadow: 0 4px 12px rgba(0,0,0,0.3);">`;
                html += `<div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.25rem;">`;
                html += `<span style="font-size: 1.2rem;">${statusIcon}</span>`;
                html += `<strong style="flex: 1;">${escapeHtml(op.description)}</strong>`;
                html += `<span style="color: var(--text-dim); font-size: 0.875rem;">${duration.toFixed(1)}s</span>`;
                html += `</div>`;
                if (op.message) {
                    html += `<div style="color: var(--text-secondary); font-size: 0.875rem; margin-top: 0.5rem;">${escapeHtml(op.message)}</div>`;
                }
                if (op.status === 'running') {
                    html += `<div style="width: 100%; height: 3px; background: var(--bg-primary); border-radius: 2px; margin-top: 0.5rem; overflow: hidden;">`;
                    html += `<div style="width: 100%; height: 100%; background: ${statusColor}; animation: progress 2s ease-in-out infinite;"></div>`;
                    html += `</div>`;
                }
                html += `</div>`;
            }

            existingContainer.innerHTML = html;
        }

        // Load bulk data for a run
        async function loadBulkData(runId, modelName, forceRefresh = false) {
            const cacheKey = `${runId}_${modelName}`;

            // Return cached data if available
            if (!forceRefresh && dataCache.runs[cacheKey]) {
                console.log('Using cached data for', cacheKey);
                return dataCache.runs[cacheKey];
            }

            const opId = startOperation('load', `Loading data for ${getModelDisplayName(modelName)}`);

            try {
                const response = await fetch(`/api/runs/${runId}/bulk-data?model_name=${encodeURIComponent(modelName)}`);
                if (!response.ok) {
                    throw new Error('Failed to load bulk data');
                }

                const data = await response.json();
                dataCache.runs[cacheKey] = data;
                dataCache.currentRunId = runId;
                dataCache.currentModelName = modelName;

                completeOperation(opId, true, `Loaded ${Object.keys(data.responses).length} responses`);
                return data;
            } catch (error) {
                completeOperation(opId, false, error.message);
                throw error;
            }
        }

        // Load global leaderboard
        async function loadUnifiedLeaderboard() {
            console.log('Loading unified leaderboard...');
            showLoading();
            try {
                console.log('Fetching /api/leaderboard/unified...');
                const response = await fetch('/api/leaderboard/unified');
                console.log('Fetch complete, status:', response.status);

                if (!response.ok) {
                    throw new Error(`Server returned ${response.status}: ${response.statusText}`);
                }

                console.log('Parsing JSON response...');
                const data = await response.json();
                console.log('Data received:', data);

                leaderboardData = data.leaderboard || {};
                console.log('Displaying leaderboard...');
                displayUnifiedLeaderboard(data.leaderboard || {});

                document.getElementById('breadcrumb').textContent = '📊 Global Leaderboard';

                // Update navigation state (home view, clear history)
                navigationHistory = [];
                currentView = {view: 'home', data: {}};
                console.log('Updating navigation...');
                updateNavigation();
                console.log('Leaderboard load complete');
            } catch (error) {
                console.error('Error loading leaderboard:', error);
                // Show error but also show empty state
                displayUnifiedLeaderboard({});
                // Optionally show error banner
                const errorDiv = document.getElementById('errorMessage');
                errorDiv.innerHTML = '<div style="background: var(--danger-bg); border: 1px solid var(--danger); border-radius: 8px; padding: 1rem; margin: 1rem 0;"><strong>⚠️ Error:</strong> ' + escapeHtml(error.message) + '</div>';
                errorDiv.style.display = 'block';

                // Still update navigation
                navigationHistory = [];
                currentView = {view: 'home', data: {}};
                updateNavigation();
            }
        }

        // Display global leaderboard
        function displayUnifiedLeaderboard(leaderboard) {
            console.log('displayUnifiedLeaderboard called with:', leaderboard);
            const content = document.getElementById('mainContent');
            content.style.display = 'block';
            document.getElementById('loadingMessage').style.display = 'none';

            let html = '<div class="leaderboard-header">';
            html += '<h2>🏆 Global Leaderboard</h2>';
            html += '</div>';

            // Check if leaderboard is empty
            if (!leaderboard || Object.keys(leaderboard).length === 0) {
                console.log('Leaderboard is empty, showing empty state');
                html += '<div class="info-banner" style="background: var(--warning-bg); border-color: var(--warning); margin: 2rem 0;">';
                html += '<strong>📊 No Results Yet</strong><br>';
                html += 'No benchmark runs have been completed yet. Run a benchmark to see results here.<br><br>';
                html += '<code>python -m src.cli --models "MODEL_NAME" --categories "CATEGORY"</code>';
                html += '</div>';
                content.innerHTML = html;
                return;
            }

            html += '<div class="info-banner">';
            html += '<strong>ℹ️ Note:</strong> Showing the latest run for each model. ';
            html += 'Click on a model to view all runs and pin a specific run to the leaderboard.';
            html += '</div>';

            html += '<div class="table-container">';
            html += '<table>';
            html += '<thead><tr>';
            html += '<th>Rank</th>';
            html += '<th>Model</th>';
            html += '<th>Score</th>';
            html += '<th>Passed</th>';
            html += '<th>Run ID</th>';
            html += '<th>Avg TPS</th>';
            html += '<th>Total Cost</th>';
            html += '<th>Actions</th>';
            html += '</tr></thead><tbody>';

            let rank = 1;
            for (const [modelName, entry] of Object.entries(leaderboard)) {
                const rankClass = rank <= 3 ? `rank-${rank}` : '';
                const passRate = (entry.passed_questions / entry.total_questions * 100).toFixed(1);
                const isPinned = entry.is_preferred ? '📌 ' : '';

                html += `<tr>`;
                html += `<td class="rank-cell ${rankClass}">#${rank}</td>`;
                html += `<td><strong>${escapeHtml(getModelDisplayName(modelName))}</strong></td>`;
                html += `<td>
                    <div class="score-bar-container">
                        <div class="score-bar">
                            <div class="score-fill" style="width: ${entry.overall_score}%"></div>
                            <div class="score-text">${entry.overall_score.toFixed(1)}/100</div>
                        </div>
                    </div>
                </td>`;
                html += `<td>
                    <span class="badge ${entry.passed_questions === entry.total_questions ? 'badge-success' : 'badge-info'}">
                        ${entry.passed_questions}/${entry.total_questions} (${passRate}%)
                    </span>
                </td>`;
                html += `<td><small>${isPinned}${entry.run_id}</small></td>`;
                html += `<td>${entry.avg_tps ? entry.avg_tps.toFixed(1) : 'N/A'}</td>`;
                html += `<td>${entry.total_cost ? '$' + entry.total_cost.toFixed(4) : 'N/A'}</td>`;
                html += `<td><button class="btn" onclick="viewModelDetailsUnified('${escapeHtml(modelName)}')">View Details</button></td>`;
                html += `</tr>`;
                rank++;
            }

            html += '</tbody></table></div>';

            content.innerHTML = html;
        }

        // View model details from global leaderboard
        async function viewModelDetailsUnified(modelName) {
            currentModel = modelName;
            showLoading();
            try {
                const runsResponse = await fetch(`/api/models/${encodeURIComponent(modelName)}/runs`);
                const runsData = await runsResponse.json();
                currentModelRuns = runsData.runs;

                if (currentModelRuns.length === 0) {
                    showError('No runs found for this model');
                    return;
                }

                await viewModelDetailsForRun(modelName, currentModelRuns[0].run_id);
            } catch (error) {
                showError('Failed to load model details: ' + error.message);
            }
        }

        // View model details for a specific run (using cached bulk data)
        async function viewModelDetailsForRun(modelName, runId) {
            showLoading();
            try {
                // Load bulk data (uses cache if available)
                const bulkData = await loadBulkData(runId, modelName);

                const prefsResponse = await fetch('/api/leaderboard/preferences');
                const prefsData = await prefsResponse.json();
                const isPreferred = prefsData.preferences[modelName] === runId;

                let html = '';

                // Header
                html += '<div class="response-header">';
                html += '<div class="response-title">';
                html += '<h2>📋 ' + escapeHtml(getModelDisplayName(modelName)) + ' - Detailed Results</h2>';
                html += '</div>';
                html += '</div>';

                // Run selector
                html += '<div class="card">';
                html += '<div class="card-header">';
                html += '<div class="card-title">🏃 Benchmark Run Selection</div>';
                html += '</div>';
                html += '<div style="display: flex; align-items: center; gap: 1rem; flex-wrap: wrap;">';
                html += '<select id="modelRunSelector" onchange="viewModelDetailsForRun(\'' + escapeHtml(modelName) + '\', this.value)" style="flex: 1; min-width: 300px; padding: 0.625rem; background: var(--bg-tertiary); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 6px;">';
                currentModelRuns.forEach(run => {
                    const selected = run.run_id === runId ? 'selected' : '';
                    const score = run.score_data ? ` - Score: ${run.score_data.overall_score.toFixed(1)}` : '';
                    html += `<option value="${run.run_id}" ${selected}>${run.run_id}${score}</option>`;
                });
                html += '</select>';

                if (isPreferred) {
                    html += '<span class="badge badge-success">📌 Used in Leaderboard</span>';
                    html += '<button class="btn" onclick="clearLeaderboardPreference(\'' + escapeHtml(modelName) + '\')">Reset to Latest</button>';
                } else {
                    html += '<button class="btn btn-success" onclick="setLeaderboardPreference(\'' + escapeHtml(modelName) + '\', \'' + runId + '\')">📌 Use in Leaderboard</button>';
                }
                html += '</div>';
                html += '</div>';

                // Display responses from cached data in a grid layout
                html += '<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(450px, 1fr)); gap: 1rem; margin-top: 1rem;">';

                for (const [questionId, responseData] of Object.entries(bulkData.responses)) {
                    const question = bulkData.questions[questionId];
                    if (!question) continue;

                    // Get primary evaluation (prefer llm_judge)
                    const evaluations = bulkData.evaluations[questionId] || {};
                    const evaluation = evaluations.llm_judge || evaluations.code_execution || Object.values(evaluations)[0];

                    const scoreClass = evaluation && evaluation.passed ? 'badge-success' : 'badge-danger';
                    const score = evaluation ? evaluation.score.toFixed(1) : 'N/A';

                    html += '<div class="card" style="cursor: pointer; margin: 0; height: 100%;" onclick="viewResponseCached(\'' + escapeHtml(modelName) + '\', \'' + questionId + '\', \'' + runId + '\')">';
                    html += '<div class="card-header" style="flex-direction: column; align-items: flex-start; gap: 0.5rem;">';
                    html += '<div style="display: flex; justify-content: space-between; width: 100%; align-items: center;">';
                    html += '<div class="card-title" style="font-size: 0.9rem; margin: 0;">' + escapeHtml(questionId) + '</div>';
                    html += '<span class="badge ' + scoreClass + '" style="font-size: 0.75rem;">' + score + '</span>';
                    html += '</div>';
                    html += '</div>';
                    html += '<div class="card-content" style="padding: 0.75rem;">';
                    html += '<p style="font-size: 0.85rem; color: var(--text-secondary); margin: 0; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;">' + escapeHtml(question.prompt) + '</p>';
                    html += '</div>';
                    html += '</div>';
                }

                html += '</div>';

                document.getElementById('breadcrumb').textContent = '📋 ' + getModelDisplayName(modelName) + ' - Run: ' + runId;
                const content = document.getElementById('mainContent');
                content.innerHTML = html;
                content.style.display = 'block';
                document.getElementById('loadingMessage').style.display = 'none';

                // Update navigation state
                pushNavigation('model-details', {modelName, runId});
            } catch (error) {
                showError('Failed to load model details: ' + error.message);
            }
        }

        // Refresh current run data
        async function refreshCurrentRunData() {
            if (dataCache.currentRunId && dataCache.currentModelName) {
                await loadBulkData(dataCache.currentRunId, dataCache.currentModelName, true);
                await viewModelDetailsForRun(dataCache.currentModelName, dataCache.currentRunId);
            }
        }

        // View response using cached data (instant, no loading)
        async function viewResponseCached(modelName, questionId, runId, useFixed = false) {
            // Just call viewResponse - it will use cache if available
            await viewResponse(modelName, questionId, runId, useFixed);
        }

        // View specific response with evaluations
        async function viewResponse(modelName, questionId, runId, useFixed = false, version = null) {
            if (!runId) return;

            // Try to use cached data first (only if no specific version requested)
            const cacheKey = `${runId}_${modelName}`;
            const cached = dataCache.runs[cacheKey];
            let data;

            if (!version && cached && cached.questions[questionId] && cached.responses[questionId]) {
                // Use cached data - instant display
                data = {
                    question: cached.questions[questionId],
                    response: cached.responses[questionId],
                    evaluations: cached.evaluations[questionId] || {},
                    has_fixed_version: cached.responses[questionId]?.has_fixed_version || false,
                    is_fixed_version: useFixed,
                    artifact: null,
                    artifact_type: null,
                    artifact_metadata: null
                };
            } else {
                // Fetch from API
                showLoading();
                try {
                    let url = `/api/runs/${runId}/models/${encodeURIComponent(modelName)}/questions/${questionId}?use_fixed=${useFixed}`;
                    if (version) {
                        url += `&version=${encodeURIComponent(version)}`;
                    }
                    const response = await fetch(url);
                    data = await response.json();
                } catch (error) {
                    showError('Failed to load response: ' + error.message);
                    return;
                }
            }

            try {
                let html = '';

                // Version selector (will be populated via AJAX)
                html += '<div id="version-selector-' + escapeHtml(questionId) + '" style="background: var(--bg-secondary); padding: 1rem; border-radius: 8px; margin-bottom: 1rem; display: flex; align-items: center; gap: 1rem; flex-wrap: wrap;"></div>';

                // Header
                html += '<div class="response-header">';
                html += '<div class="response-title">';
                html += '<h2>📄 Response Viewer</h2>';
                html += '<p style="color: var(--text-secondary); margin-top: 0.5rem;"><strong>' + escapeHtml(data.question.id) + '</strong></p>';
                html += '</div>';
                html += '<div class="response-actions">';
                html += '<button class="btn btn-primary" onclick="regenerateResponse(\'' + escapeHtml(modelName) + '\', \'' + questionId + '\', \'' + runId + '\')">🔄 Regenerate Response & Evaluate</button>';
                html += '<button class="btn" onclick="reEvaluateResponse(\'' + escapeHtml(modelName) + '\', \'' + questionId + '\', \'' + runId + '\')">📊 Re-Evaluate Only</button>';
                // Add Fix Response button for code-based questions
                if (data.question.evaluation_type === 'code_execution' || data.question.evaluation_type === 'code_execution_multi_file') {
                    html += '<button class="btn" onclick="fixResponse(\'' + escapeHtml(modelName) + '\', \'' + questionId + '\', \'' + runId + '\')">🔧 Fix Response</button>';
                }
                html += '</div>';
                html += '</div>';

                // Load versions asynchronously
                setTimeout(() => loadVersionSelector(modelName, questionId, runId), 100);

                // Two-column layout for better horizontal space usage
                html += '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; margin-top: 1rem;">';

                // LEFT COLUMN: Question + Evaluations
                html += '<div style="display: flex; flex-direction: column; gap: 1.5rem;">';

                // Question
                html += '<div class="card" style="margin: 0;">';
                html += '<div class="card-header">';
                html += '<div class="card-title">❓ Question</div>';
                html += '</div>';
                html += '<div class="card-content">';
                html += '<p>' + escapeHtml(data.question.prompt) + '</p>';
                if (data.question.evaluation_criteria) {
                    html += '<div style="margin-top: 1rem; padding: 1rem; background: var(--bg-tertiary); border-radius: 8px;">';
                    html += '<strong style="color: var(--text-dim); font-size: 0.875rem;">Evaluation Criteria:</strong>';
                    html += '<p style="margin-top: 0.5rem;">' + escapeHtml(data.question.evaluation_criteria) + '</p>';
                    html += '</div>';
                    }
                html += '</div>';
                html += '</div>';

                // Evaluations
                if (data.evaluations && Object.keys(data.evaluations).length > 0) {
                    html += '<div>';
                    html += '<h3 style="margin: 0 0 1rem 0; font-size: 1.25rem;">📊 Evaluations</h3>';
                    html += '<div style="display: flex; flex-direction: column; gap: 1rem;">';

                    // LLM Judge first (if exists)
                    if (data.evaluations.llm_judge) {
                        html += renderEvaluationCard(data.evaluations.llm_judge, true);
                    }

                    // Then other evaluations
                    for (const [type, eval] of Object.entries(data.evaluations)) {
                        if (type !== 'llm_judge') {
                            html += renderEvaluationCard(eval, false);
                        }
                    }

                    html += '</div>';
                    html += '</div>';
                }

                html += '</div>'; // End left column

                // RIGHT COLUMN: Artifact/Code + Response + Metrics
                html += '<div style="display: flex; flex-direction: column; gap: 1.5rem;">';

                // Artifact or Code Execution
                if (data.artifact) {
                    // Server-provided artifact (HTML or multi-file) - show as execution panel, not auto-run
                    const artifactId = questionId.replace(/[^a-zA-Z0-9]/g, '_') + '_artifact';
                    html += '<div class="artifact-viewer" id="exec-container-' + artifactId + '">';
                    html += '<div class="section-header">';
                    html += '<h3>🎨 Web Application';
                    if (data.artifact_type === 'multi_file') {
                        html += '<span class="language-badge">📦 Multi-file Project</span>';
                    }
                    html += '<span class="status-indicator ready" id="webapp-status-' + artifactId + '">Ready to Run</span>';
                    html += '</h3>';
                    html += '<div style="display: flex; gap: 0.75rem;">';
                    html += '<button class="btn-execute" onclick="runWebApp(\'' + artifactId + '\')">▶️ Run Application</button>';
                    html += '<button class="btn" onclick="popOutWebApp(\'' + artifactId + '\')">🗗 Pop Out</button>';
                    html += '</div>';
                    html += '</div>';

                    if (data.artifact_type === 'multi_file') {
                        html += '<div style="background: var(--bg-tertiary); border: 1px solid var(--border-color); border-radius: 8px; padding: 1rem; margin-bottom: 1rem;">';
                        html += '<div style="color: var(--text-secondary); font-size: 0.875rem; margin-bottom: 0.5rem;"><strong>Project Files:</strong></div>';
                        html += '<div style="display: flex; flex-wrap: wrap; gap: 0.5rem;">';
                        data.artifact_metadata.files.forEach(file => {
                            html += '<span class="badge badge-info">' + escapeHtml(file) + '</span>';
                        });
                        html += '</div>';
                        html += '</div>';
                        html += '<div id="webapp-' + artifactId + '" data-src="' + data.artifact + '" data-type="multi_file" style="display: none;"></div>';
                    } else if (data.artifact_type === 'html') {
                        html += '<div id="webapp-' + artifactId + '" data-html="' + escapeHtml(data.artifact) + '" data-type="html" style="display: none;"></div>';
                    }
                    html += '<div id="preview-' + artifactId + '" class="artifact-iframe-container" style="display: none;"></div>';
                    html += '</div>';
                } else if (data.response.response_text) {
                    // Try to extract code for execution or preview
                    const codeBlockPattern = /```(\w+)\n([\s\S]*?)```/g;
                    const codeBlocks = [];
                    let match;

                    while ((match = codeBlockPattern.exec(data.response.response_text)) !== null) {
                        codeBlocks.push({
                            language: match[1].toLowerCase(),
                            code: match[2]
                        });
                    }

                    if (codeBlocks.length > 0) {
                        // Process each code block
                        for (let i = 0; i < codeBlocks.length; i++) {
                            const block = codeBlocks[i];
                            const codeId = questionId.replace(/[^a-zA-Z0-9]/g, '_') + '_' + i;

                            // HTML gets execution panel (no auto-run)
                            if (block.language === 'html') {
                                html += '<div class="artifact-viewer" id="exec-container-' + codeId + '">';
                                html += '<div class="section-header">';
                                html += '<h3>🎨 HTML Web Application';
                                html += '<span class="status-indicator ready" id="webapp-status-' + codeId + '">Ready to Run</span>';
                                html += '</h3>';
                                html += '<div style="display: flex; gap: 0.75rem;">';
                                html += '<button class="btn-execute" onclick="runWebApp(\'' + codeId + '\')">▶️ Run Application</button>';
                                html += '<button class="btn" onclick="popOutWebApp(\'' + codeId + '\')">🗗 Pop Out</button>';
                                html += '</div>';
                                html += '</div>';
                                html += '<div id="webapp-' + codeId + '" data-html="' + escapeHtml(block.code) + '" data-type="html" style="display: none;"></div>';
                                html += '<div id="preview-' + codeId + '" class="artifact-iframe-container" style="display: none;"></div>';
                                html += '</div>';
                            } else {
                                // Executable languages get interactive terminal
                                const executableLangs = ['python', 'javascript', 'js', 'node', 'rust', 'rs', 'go', 'cpp', 'c++', 'c', 'java', 'ruby', 'rb', 'php'];

                                if (executableLangs.includes(block.language)) {
                                    // Normalize language names
                                    let normalizedLang = block.language;
                                    if (normalizedLang === 'js' || normalizedLang === 'node') normalizedLang = 'javascript';
                                    if (normalizedLang === 'rs') normalizedLang = 'rust';
                                    if (normalizedLang === 'c++') normalizedLang = 'cpp';
                                    if (normalizedLang === 'rb') normalizedLang = 'ruby';

                                    const langIcons = {
                                        'python': '🐍',
                                        'javascript': '📜',
                                        'rust': '🦀',
                                        'go': '🔷',
                                        'cpp': '⚡',
                                        'c': '⚡',
                                        'java': '☕',
                                        'ruby': '💎',
                                        'php': '🐘'
                                    };

                                    const langNames = {
                                        'python': 'Python',
                                        'javascript': 'JavaScript',
                                        'rust': 'Rust',
                                        'go': 'Go',
                                        'cpp': 'C++',
                                        'c': 'C',
                                        'java': 'Java',
                                        'ruby': 'Ruby',
                                        'php': 'PHP'
                                    };

                                    // Create session ID for persistent temp directories
                                    const sessionId = runId + '_' + modelName.replace(/\//g, '_') + '_' + questionId + '_' + (data.response.version || 'latest');

                                    html += '<div class="artifact-viewer" id="exec-container-' + codeId + '" data-session-id="' + sessionId + '">';
                                    html += '<div class="section-header">';
                                    html += '<h3>' + (langIcons[normalizedLang] || '💻') + ' ' + (langNames[normalizedLang] || normalizedLang.toUpperCase()) + ' Code';
                                    html += '<span class="status-indicator ready" id="status-' + codeId + '">Ready to Run</span>';
                                    html += '</h3>';
                                    html += '<div style="display: flex; gap: 0.75rem;">';
                                    html += '<button class="btn-execute" onclick="runCodeInteractive(\'' + codeId + '\', \'' + normalizedLang + '\')">▶️ Run Code</button>';
                                    html += '<button class="btn" onclick="popOutExecution(\'' + codeId + '\', \'' + normalizedLang + '\')">🗗 Pop Out</button>';
                                    html += '</div>';
                                    html += '</div>';

                                    // Interactive terminal interface with enhanced styling
                                    html += '<div class="code-execution-panel">';
                                    html += '<div class="execution-input-group">';
                                    html += '<label for="args-' + codeId + '">Arguments</label>';
                                    html += '<input type="text" id="args-' + codeId + '" placeholder="e.g., --help, add task, etc." />';
                                    html += '</div>';
                                    html += '<div class="execution-input-group" style="align-items: flex-start;">';
                                    html += '<label for="stdin-' + codeId + '" style="padding-top: 0.625rem;">Stdin</label>';
                                    html += '<textarea id="stdin-' + codeId + '" placeholder="Input data (optional)" rows="3"></textarea>';
                                    html += '</div>';
                                    html += '</div>';

                                    html += '<pre id="code-' + codeId + '" style="display: none;">' + escapeHtml(block.code) + '</pre>';
                                    html += '<div id="output-' + codeId + '" class="execution-output" style="display: none;"></div>';
                                    html += '</div>';
                                }
                            }
                        }
                    }
                }

                // Response Text
                html += '<div class="card" style="margin: 0;">';
                html += '<div class="card-header">';
                html += '<div style="display: flex; justify-content: space-between; align-items: center;">';
                html += '<div class="card-title collapsible" onclick="toggleSection(\'response-text\')">💬 Model Response <span id="response-text-toggle">[+]</span></div>';
                html += '<button class="btn" onclick="popOutResponse(\'' + questionId + '\')" style="font-size: 0.875rem; padding: 0.5rem 1rem;">🗗 Pop Out</button>';
                html += '</div>';
                html += '</div>';
                html += '<div id="response-text" class="collapsible-content">';
                html += '<div id="response-content-' + questionId + '" class="markdown-content"></div>';
                html += '</div>';
                html += '</div>';

                // Render markdown after DOM is updated
                setTimeout(() => {
                    const responseElement = document.getElementById('response-content-' + questionId);
                    if (responseElement) {
                        responseElement.innerHTML = renderMarkdown(data.response.response_text);
                        // Apply syntax highlighting to all code blocks
                        responseElement.querySelectorAll('pre code').forEach(block => {
                            hljs.highlightElement(block);
                        });
                    }
                }, 0);

                // Metrics
                if (data.response.metrics && Object.keys(data.response.metrics).length > 0) {
                    html += '<div>';
                    html += '<h3 style="margin: 0 0 1rem 0; font-size: 1.25rem;">📈 Performance Metrics</h3>';
                    html += '<div class="metrics-grid">';
                    const m = data.response.metrics;
                    if (m.ttft) html += '<div class="metric-card"><div class="metric-label">TTFT</div><div class="metric-value">' + m.ttft.toFixed(2) + 's</div></div>';
                    if (m.tokens_per_second) html += '<div class="metric-card"><div class="metric-label">TPS</div><div class="metric-value">' + m.tokens_per_second.toFixed(1) + '</div></div>';
                    if (m.total_tokens) html += '<div class="metric-card"><div class="metric-label">Tokens</div><div class="metric-value">' + m.total_tokens.toLocaleString() + '</div></div>';
                    if (m.estimated_cost) html += '<div class="metric-card"><div class="metric-label">Cost</div><div class="metric-value">$' + m.estimated_cost.toFixed(4) + '</div></div>';
                    html += '</div>';
                    html += '</div>';
                }

                html += '</div>'; // End right column
                html += '</div>'; // End two-column grid

                document.getElementById('breadcrumb').textContent = '📄 ' + getModelDisplayName(modelName) + ' - ' + questionId;
                const content = document.getElementById('mainContent');
                content.innerHTML = html;
                content.style.display = 'block';
                document.getElementById('loadingMessage').style.display = 'none';

                // Update navigation state
                pushNavigation('response', {modelName, questionId, runId});
            } catch (error) {
                showError('Failed to load response: ' + error.message);
            }
        }

        // Render evaluation card
        function renderEvaluationCard(evaluation, isPrimary) {
            const typeLabels = {
                'llm_judge': 'LLM Judge',
                'code_execution': 'Code Execution',
                'tool_calling': 'Tool Calling',
                'exact_match': 'Exact Match',
                'contains': 'Contains Check'
            };

            const scoreColor = evaluation.passed ? 'var(--success)' : 'var(--danger)';
            const typeLabel = typeLabels[evaluation.evaluation_type] || evaluation.evaluation_type;

            let html = '<div class="eval-card' + (isPrimary ? ' primary' : '') + '">';
            html += '<div class="eval-header">';
            html += '<div>';
            html += '<div class="eval-type">' + escapeHtml(typeLabel) + '</div>';
            if (evaluation.evaluator_model) {
                html += '<div style="font-size: 0.75rem; color: var(--text-dim); margin-top: 0.25rem;">Model: ' + escapeHtml(evaluation.evaluator_model) + '</div>';
            }
            html += '</div>';
            html += '<div class="eval-score-display">';
            html += '<div class="eval-score-value" style="color: ' + scoreColor + '">' + evaluation.score.toFixed(1) + '</div>';
            html += '<div class="eval-score-label">out of 100</div>';
            html += '<div style="margin-top: 0.5rem;">';
            html += '<span class="badge ' + (evaluation.passed ? 'badge-success' : 'badge-danger') + '">' + (evaluation.passed ? '✓ Passed' : '✗ Failed') + '</span>';
            html += '</div>';
            html += '</div>';
            html += '</div>';

            if (evaluation.reasoning) {
                html += '<div class="eval-reasoning">';
                html += '<strong style="display: block; margin-bottom: 0.5rem; color: var(--text-dim);">Reasoning:</strong>';
                html += escapeHtml(evaluation.reasoning);
                html += '</div>';
            }

            // Show code execution details if available
            if (evaluation.details) {
                const details = evaluation.details;
                if (details.language || details.execution_success !== undefined) {
                    html += '<div class="eval-details">';

                    if (details.language) {
                        html += '<div class="detail-item">';
                        html += '<span class="detail-label">Language:</span>';
                        html += '<span class="detail-value">' + escapeHtml(details.language) + '</span>';
                        html += '</div>';
                    }

                    if (details.execution_success !== undefined) {
                        html += '<div class="detail-item">';
                        html += '<span class="detail-label">Execution:</span>';
                        html += '<span class="badge ' + (details.execution_success ? 'badge-success' : 'badge-danger') + '">' + (details.execution_success ? '✓ Success' : '✗ Failed') + '</span>';
                        html += '</div>';
                    }

                    if (details.output) {
                        html += '<div style="margin-top: 1rem;">';
                        html += '<strong style="display: block; margin-bottom: 0.5rem; color: var(--text-dim);">Output:</strong>';
                        html += '<div class="code-output success">' + escapeHtml(details.output) + '</div>';
                        html += '</div>';
                    }

                    if (details.error) {
                        html += '<div style="margin-top: 1rem;">';
                        html += '<strong style="display: block; margin-bottom: 0.5rem; color: var(--text-dim);">Error:</strong>';
                        html += '<div class="code-output error">' + escapeHtml(details.error) + '</div>';
                        html += '</div>';
                    }

                    html += '</div>';
                }
            }

            html += '</div>';
            return html;
        }

        // Re-evaluate response
        // Re-evaluate response (async, non-blocking)
        async function reEvaluateResponse(modelName, questionId, runId) {
            const opId = startOperation('re-evaluate', `Re-evaluating ${questionId}`);

            // Run in background
            (async () => {
                try {
                    const response = await fetch(`/api/runs/${runId}/models/${encodeURIComponent(modelName)}/questions/${questionId}/re-evaluate`, {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'}
                    });

                    if (!response.ok) {
                        const error = await response.json();
                        throw new Error(error.detail || 'Re-evaluation failed');
                    }

                    const data = await response.json();

                    // Refresh cache for this run
                    const cacheKey = `${runId}_${modelName}`;
                    if (dataCache.runs[cacheKey]) {
                        // Update cache with new evaluations
                        const evalResp = await fetch(`/api/runs/${runId}/models/${encodeURIComponent(modelName)}/questions/${questionId}`);
                        if (evalResp.ok) {
                            const evalData = await evalResp.json();
                            dataCache.runs[cacheKey].evaluations[questionId] = evalData.evaluations;
                        }
                    }

                    completeOperation(opId, true, data.message);

                    // Refresh the view if we're currently looking at this response
                    const currentView = document.getElementById('mainContent').innerHTML;
                    if (currentView.includes(questionId)) {
                        await viewResponseCached(modelName, questionId, runId);
                    }
                } catch (error) {
                    completeOperation(opId, false, error.message);
                }
            })();

            // Don't block - return immediately
            return Promise.resolve();
        }

        // Fix response formatting using LLM
        async function fixResponse(modelName, questionId, runId) {
            const opId = startOperation('fix-response', `Fixing response for ${questionId}`);

            // Run in background
            (async () => {
                try {
                    const response = await fetch(`/api/runs/${runId}/models/${encodeURIComponent(modelName)}/questions/${questionId}/fix`, {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({}) // Can optionally specify fixer_model
                    });

                    if (!response.ok) {
                        const error = await response.json();
                        throw new Error(error.detail || 'Fix failed');
                    }

                    const data = await response.json();

                    // Refresh cache for this run
                    const cacheKey = `${runId}_${modelName}`;
                    if (dataCache.runs[cacheKey]) {
                        // Update cache with fixed response
                        const respResp = await fetch(`/api/runs/${runId}/models/${encodeURIComponent(modelName)}/questions/${questionId}`);
                        if (respResp.ok) {
                            const respData = await respResp.json();
                            dataCache.runs[cacheKey].responses[questionId] = respData.response;
                        }
                    }

                    completeOperation(opId, true, data.message || 'Response fixed successfully');

                    // Refresh the view if we're currently looking at this response
                    const currentView = document.getElementById('mainContent').innerHTML;
                    if (currentView.includes(questionId)) {
                        await viewResponseCached(modelName, questionId, runId);
                    }
                } catch (error) {
                    completeOperation(opId, false, error.message);
                }
            })();

            // Don't block - return immediately
            return Promise.resolve();
        }

        // Load and display version selector
        async function loadVersionSelector(modelName, questionId, runId) {
            try {
                const response = await fetch(`/api/runs/${runId}/models/${encodeURIComponent(modelName)}/questions/${questionId}/versions`);
                if (!response.ok) return;

                const data = await response.json();
                const versions = data.versions || [];

                if (versions.length <= 1) {
                    // Don't show selector if only one version
                    return;
                }

                const selectorDiv = document.getElementById(`version-selector-${questionId}`);
                if (!selectorDiv) return;

                let html = '<strong style="color: var(--text-primary);">Response Version:</strong>';

                // Add version dropdown
                html += '<select id="version-select-' + questionId + '" onchange="switchToVersion(\'' + escapeHtml(modelName) + '\', \'' + questionId + '\', \'' + runId + '\', this.value)" style="padding: 0.5rem; background: var(--bg-tertiary); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 6px;">';

                versions.forEach((v, idx) => {
                    const date = new Date(v.created_at).toLocaleString();
                    const label = v.is_latest ? `Latest (${date})` : date;
                    const selected = v.is_latest ? 'selected' : '';
                    html += `<option value="${v.version}" ${selected}>Version ${idx + 1}: ${label}</option>`;
                });

                html += '</select>';
                html += '<span style="color: var(--text-secondary); font-size: 0.875rem;">${versions.length} version(s) available</span>';

                selectorDiv.innerHTML = html;
            } catch (error) {
                console.error('Failed to load versions:', error);
            }
        }

        // Switch to a specific version
        async function switchToVersion(modelName, questionId, runId, version) {
            // Reload the response with the specified version
            const opId = startOperation('switch-version', `Loading version...`);

            try {
                await viewResponse(modelName, questionId, runId, false, version);
                completeOperation(opId, true, 'Version loaded');

                // Reload version selector to update UI
                setTimeout(() => loadVersionSelector(modelName, questionId, runId), 100);
            } catch (error) {
                completeOperation(opId, false, error.message);
            }
        }

        // Regenerate response (creates new version)
        async function regenerateResponse(modelName, questionId, runId) {
            const opId = startOperation('regenerate', `Regenerating response for ${questionId}`);

            // Run in background
            (async () => {
                try {
                    const response = await fetch(`/api/runs/${runId}/models/${encodeURIComponent(modelName)}/questions/${questionId}/regenerate`, {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'}
                    });

                    if (!response.ok) {
                        const error = await response.json();
                        throw new Error(error.detail || 'Regeneration failed');
                    }

                    const data = await response.json();

                    // Clear cache to force reload
                    const cacheKey = `${runId}_${modelName}`;
                    delete dataCache.runs[cacheKey];

                    completeOperation(opId, true, data.message || 'Response regenerated successfully');

                    // Refresh the view to show new version
                    const currentView = document.getElementById('mainContent').innerHTML;
                    if (currentView.includes(questionId)) {
                        await viewResponseCached(modelName, questionId, runId);
                    }
                } catch (error) {
                    completeOperation(opId, false, error.message);
                }
            })();

            // Don't block - return immediately
            return Promise.resolve();
        }

        // Bulk re-evaluate multiple responses
        async function bulkReEvaluate(modelName, runId, questionIds) {
            for (const questionId of questionIds) {
                await reEvaluateResponse(modelName, questionId, runId);
                // Small delay between requests
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }

        // Run code (Python or JavaScript)
        async function runCode(codeId, language) {
            const opId = startOperation('run-code', `Running ${language} code`);
            const codeElement = document.getElementById('code-' + codeId);
            const outputElement = document.getElementById('output-' + codeId);

            if (!codeElement) {
                completeOperation(opId, false, 'Code element not found');
                return;
            }

            const code = codeElement.textContent;

            try {
                const response = await fetch('/api/execute', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({
                        code: code,
                        language: language,
                        timeout: 30
                    })
                });

                if (!response.ok) {
                    throw new Error('Execution request failed');
                }

                const data = await response.json();

                // Display output
                outputElement.style.display = 'block';
                let outputHtml = '';

                if (data.stdout) {
                    outputHtml += '<div style="color: var(--success); margin-bottom: 0.5rem;"><strong>Output:</strong></div>';
                    outputHtml += '<pre style="color: var(--text-primary); margin: 0;">' + escapeHtml(data.stdout) + '</pre>';
                }

                if (data.stderr) {
                    if (outputHtml) outputHtml += '<div style="margin: 1rem 0; border-top: 1px solid var(--border-color);"></div>';
                    outputHtml += '<div style="color: var(--danger); margin-bottom: 0.5rem;"><strong>Errors:</strong></div>';
                    outputHtml += '<pre style="color: var(--danger); margin: 0;">' + escapeHtml(data.stderr) + '</pre>';
                }

                if (!data.stdout && !data.stderr) {
                    outputHtml = '<div style="color: var(--text-secondary);">No output</div>';
                }

                outputElement.innerHTML = outputHtml;

                completeOperation(opId, data.success, data.success ? 'Code executed successfully' : 'Code execution failed');
            } catch (error) {
                completeOperation(opId, false, error.message);
                outputElement.style.display = 'block';
                outputElement.innerHTML = '<div style="color: var(--danger);"><strong>Error:</strong> ' + escapeHtml(error.message) + '</div>';
            }
        }

        // Run code with interactive arguments and stdin
        async function runCodeInteractive(codeId, language) {
            const opId = startOperation('run-code', `Running ${language} code`);
            const codeElement = document.getElementById('code-' + codeId);
            const outputElement = document.getElementById('output-' + codeId);
            const argsElement = document.getElementById('args-' + codeId);
            const stdinElement = document.getElementById('stdin-' + codeId);
            const containerElement = document.getElementById('exec-container-' + codeId);
            const statusElement = document.getElementById('status-' + codeId);

            if (!codeElement) {
                completeOperation(opId, false, 'Code element not found');
                return;
            }

            // Update UI to show running state
            if (statusElement) {
                statusElement.className = 'status-indicator running';
                statusElement.textContent = 'Running...';
            }
            if (containerElement) {
                containerElement.classList.add('executing');
            }

            const code = codeElement.textContent;
            const args = argsElement ? argsElement.value : '';
            const stdin = stdinElement ? stdinElement.value : '';
            const sessionId = containerElement ? containerElement.getAttribute('data-session-id') : '';

            try {
                const response = await fetch('/api/execute', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({
                        code: code,
                        language: language,
                        args: args,
                        stdin: stdin,
                        session_id: sessionId,
                        timeout: 30
                    })
                });

                if (!response.ok) {
                    throw new Error('Execution request failed');
                }

                const data = await response.json();

                // Display output
                outputElement.style.display = 'block';
                outputElement.className = 'execution-output ' + (data.success ? 'success' : 'error');
                let outputHtml = '';

                // Show command that was executed
                outputHtml += '<div style="color: var(--text-secondary); margin-bottom: 0.75rem; font-size: 0.875rem; padding-bottom: 0.75rem; border-bottom: 1px solid var(--border-color);"><strong>Command:</strong> ';
                if (language === 'python') {
                    outputHtml += '<code>python script.py ' + escapeHtml(args) + '</code>';
                } else if (language === 'rust') {
                    outputHtml += '<code>cargo run' + (args ? ' -- ' + escapeHtml(args) : '') + '</code>';
                } else if (language === 'go') {
                    outputHtml += '<code>go run main.go ' + escapeHtml(args) + '</code>';
                } else if (language === 'cpp' || language === 'c') {
                    outputHtml += '<code>./program ' + escapeHtml(args) + '</code>';
                } else if (language === 'java') {
                    outputHtml += '<code>java Main ' + escapeHtml(args) + '</code>';
                } else {
                    outputHtml += '<code>' + language + ' ' + escapeHtml(args) + '</code>';
                }
                outputHtml += '</div>';

                if (data.stdout) {
                    outputHtml += '<div style="color: var(--success); margin-bottom: 0.5rem; font-weight: 600;"><strong>✓ Output:</strong></div>';
                    outputHtml += '<pre style="color: var(--text-primary); margin: 0; white-space: pre-wrap;">' + escapeHtml(data.stdout) + '</pre>';
                }

                if (data.stderr) {
                    if (data.stdout) outputHtml += '<div style="margin: 1rem 0; border-top: 1px solid var(--border-color);"></div>';
                    outputHtml += '<div style="color: var(--danger); margin-bottom: 0.5rem; font-weight: 600;"><strong>✗ Error:</strong></div>';
                    outputHtml += '<pre style="color: var(--danger); margin: 0; white-space: pre-wrap;">' + escapeHtml(data.stderr) + '</pre>';
                }

                if (!data.stdout && !data.stderr) {
                    outputHtml += '<div style="color: var(--text-secondary); text-align: center; padding: 2rem;">No output produced</div>';
                }

                outputElement.innerHTML = outputHtml;

                // Update status
                if (statusElement) {
                    statusElement.className = 'status-indicator ' + (data.success ? 'ready' : 'error');
                    statusElement.textContent = data.success ? 'Executed Successfully' : 'Execution Failed';
                }

                completeOperation(opId, data.success, data.success ? 'Code executed successfully' : 'Code execution failed');
            } catch (error) {
                completeOperation(opId, false, error.message);
                outputElement.style.display = 'block';
                outputElement.className = 'execution-output error';
                outputElement.innerHTML = '<div style="color: var(--danger); text-align: center; padding: 2rem;"><strong>✗ Error:</strong> ' + escapeHtml(error.message) + '</div>';

                if (statusElement) {
                    statusElement.className = 'status-indicator error';
                    statusElement.textContent = 'Error';
                }
            } finally {
                // Remove executing animation
                if (containerElement) {
                    containerElement.classList.remove('executing');
                }
            }
        }

        // Pop out response in new window with markdown formatting
        function popOutResponse(questionId) {
            const contentElement = document.getElementById('response-content-' + questionId);
            if (!contentElement) return;

            const content = contentElement.textContent;
            const win = window.open('', '_blank', 'width=900,height=700,menubar=no,toolbar=no,location=no,status=no');

            if (win) {
                const doc = win.document;
                doc.open();
                doc.write('<!DOCTYPE html><html><head><title>Response - ' + questionId + '</title>');
                doc.write('<style>');
                doc.write('body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 2rem; background: #1a1a1a; color: #e0e0e0; line-height: 1.6; max-width: 900px; margin: 0 auto; }');
                doc.write('h1, h2, h3, h4, h5, h6 { color: #ffffff; margin-top: 1.5rem; margin-bottom: 0.75rem; font-weight: 600; }');
                doc.write('h1 { font-size: 2rem; border-bottom: 2px solid #3a3a3a; padding-bottom: 0.5rem; }');
                doc.write('h2 { font-size: 1.5rem; border-bottom: 1px solid #3a3a3a; padding-bottom: 0.25rem; }');
                doc.write('h3 { font-size: 1.25rem; }');
                doc.write('h4 { font-size: 1.1rem; }');
                doc.write('p { margin: 0.75rem 0; }');
                doc.write('code { background: #2a2a2a; padding: 0.2rem 0.4rem; border-radius: 4px; font-family: "Consolas", "Monaco", monospace; font-size: 0.9em; color: #4ade80; }');
                doc.write('pre { white-space: pre-wrap; word-wrap: break-word; background: #2a2a2a; padding: 1rem; border-radius: 8px; border: 1px solid #3a3a3a; overflow-x: auto; }');
                doc.write('pre code { background: none; padding: 0; color: #e0e0e0; }');
                doc.write('blockquote { border-left: 4px solid #0066cc; margin: 1rem 0; padding-left: 1rem; color: #a0a0a0; font-style: italic; }');
                doc.write('ul, ol { margin: 0.75rem 0; padding-left: 2rem; }');
                doc.write('li { margin: 0.25rem 0; }');
                doc.write('a { color: #0066cc; text-decoration: none; }');
                doc.write('a:hover { text-decoration: underline; }');
                doc.write('hr { border: none; border-top: 1px solid #3a3a3a; margin: 1.5rem 0; }');
                doc.write('table { border-collapse: collapse; width: 100%; margin: 1rem 0; }');
                doc.write('th, td { border: 1px solid #3a3a3a; padding: 0.5rem; text-align: left; }');
                doc.write('th { background: #2a2a2a; font-weight: 600; }');
                doc.write('strong { color: #ffffff; font-weight: 600; }');
                doc.write('em { font-style: italic; }');
                doc.write('.page-header { font-size: 1.25rem; margin-bottom: 1.5rem; border-bottom: 2px solid #3a3a3a; padding-bottom: 0.5rem; color: #a0a0a0; }');
                doc.write('</style></head><body>');
                doc.write('<div class="page-header">Model Response: ' + questionId + '</div>');
                doc.write('<div id="content"></div>');
                doc.write('</body></html>');
                doc.close();

                // Simple markdown-like formatting
                win.document.getElementById('content').innerHTML = formatMarkdown(content);
            }
        }

        // Render markdown with syntax highlighting
        function renderMarkdown(text) {
            if (typeof marked === 'undefined') {
                // Fallback if marked.js is not loaded
                return escapeHtml(text).replace(/\n/g, '<br>');
            }

            // Configure marked for syntax highlighting
            marked.setOptions({
                highlight: function(code, lang) {
                    if (lang && hljs.getLanguage(lang)) {
                        try {
                            return hljs.highlight(code, { language: lang }).value;
                        } catch (err) {}
                    }
                    try {
                        return hljs.highlightAuto(code).value;
                    } catch (err) {}
                    return code;
                },
                breaks: true,
                gfm: true
            });

            return marked.parse(text);
        }

        // Legacy function for popup windows - keep for compatibility
        function formatMarkdown(text) {
            return renderMarkdown(text);
        }

        // Run web application (HTML/multi-file)
        function runWebApp(appId) {
            const webappElement = document.getElementById('webapp-' + appId);
            const previewElement = document.getElementById('preview-' + appId);
            const statusElement = document.getElementById('webapp-status-' + appId);

            if (!webappElement || !previewElement) return;

            // Update status to running
            if (statusElement) {
                statusElement.className = 'status-indicator running';
                statusElement.textContent = 'Loading...';
            }

            const dataType = webappElement.getAttribute('data-type');

            // Show preview container
            previewElement.style.display = 'block';

            // Clear previous content
            previewElement.innerHTML = '';

            // Show loading indicator
            previewElement.innerHTML = '<div style="display: flex; align-items: center; justify-content: center; height: 600px; background: var(--bg-primary); border-radius: 12px;"><div class="spinner"></div><span style="margin-left: 1rem; color: var(--text-secondary);">Loading application...</span></div>';

            setTimeout(() => {
                previewElement.innerHTML = '';

                if (dataType === 'html') {
                    // Single HTML file
                    const htmlContent = webappElement.getAttribute('data-html');
                    const iframe = document.createElement('iframe');
                    iframe.className = 'artifact-iframe';
                    iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms');
                    iframe.srcdoc = htmlContent;
                    iframe.style.width = '100%';
                    iframe.style.height = '600px';
                    iframe.style.border = 'none';

                    // Update status when loaded
                    iframe.onload = function() {
                        if (statusElement) {
                            statusElement.className = 'status-indicator ready';
                            statusElement.textContent = 'Running';
                        }
                    };

                    previewElement.appendChild(iframe);
                } else if (dataType === 'multi_file') {
                    // Multi-file application
                    const src = webappElement.getAttribute('data-src');
                    const iframe = document.createElement('iframe');
                    iframe.className = 'artifact-iframe';
                    iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms');
                    iframe.src = src;
                    iframe.style.width = '100%';
                    iframe.style.height = '600px';
                    iframe.style.border = 'none';

                    // Update status when loaded
                    iframe.onload = function() {
                        if (statusElement) {
                            statusElement.className = 'status-indicator ready';
                            statusElement.textContent = 'Running';
                        }
                    };

                    previewElement.appendChild(iframe);
                }
            }, 300); // Small delay for visual feedback
        }

        // Pop out web application in new window
        function popOutWebApp(appId) {
            const webappElement = document.getElementById('webapp-' + appId);
            if (!webappElement) return;

            const dataType = webappElement.getAttribute('data-type');
            const win = window.open('', '_blank', 'width=1000,height=700');

            if (win) {
                if (dataType === 'html') {
                    const htmlContent = webappElement.getAttribute('data-html');
                    win.document.write(htmlContent);
                    win.document.close();
                } else if (dataType === 'multi_file') {
                    const src = webappElement.getAttribute('data-src');
                    win.location.href = src;
                }
            }
        }

        // Pop out execution panel in new window
        function popOutExecution(codeId, language) {
            const codeElement = document.getElementById('code-' + codeId);
            const outputElement = document.getElementById('output-' + codeId);

            if (!codeElement) return;

            const code = codeElement.textContent;
            const output = outputElement ? outputElement.innerHTML : '';

            const win = window.open('', '_blank', 'width=1000,height=700,menubar=no,toolbar=no,location=no,status=no');

            if (win) {
                const doc = win.document;
                doc.open();
                doc.write('<!DOCTYPE html><html><head><title>' + language + ' Execution</title>');
                doc.write('<style>');
                doc.write('body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 1.5rem; background: #1a1a1a; color: #e0e0e0; margin: 0; }');
                doc.write('h1 { font-size: 1.5rem; margin-bottom: 1rem; border-bottom: 2px solid #3a3a3a; padding-bottom: 0.5rem; }');
                doc.write('.terminal { background: #2a2a2a; border: 1px solid #3a3a3a; border-radius: 8px; padding: 1rem; margin-bottom: 1rem; }');
                doc.write('input, textarea { width: 100%; background: #1a1a1a; border: 1px solid #3a3a3a; border-radius: 4px; padding: 0.5rem; color: #e0e0e0; font-family: monospace; box-sizing: border-box; }');
                doc.write('button { background: #0066cc; color: white; border: none; border-radius: 4px; padding: 0.5rem 1rem; cursor: pointer; font-size: 1rem; margin-top: 0.5rem; }');
                doc.write('button:hover { background: #0052a3; }');
                doc.write('.output { background: #2a2a2a; border: 1px solid #3a3a3a; border-radius: 8px; padding: 1rem; margin-top: 1rem; white-space: pre-wrap; }');
                doc.write('label { display: block; margin-bottom: 0.5rem; color: #a0a0a0; font-size: 0.875rem; }');
                doc.write('.code-display { display: none; }');
                doc.write('</style></head><body>');
                doc.write('<h1>' + language.toUpperCase() + ' Interactive Execution</h1>');
                doc.write('<div class="terminal">');
                doc.write('<label>Arguments:</label>');
                doc.write('<input type="text" id="args" placeholder="e.g., --help, add task, etc." />');
                doc.write('<label style="margin-top: 1rem;">Stdin:</label>');
                doc.write('<textarea id="stdin" rows="3" placeholder="Input data (optional)"></textarea>');
                doc.write('<button onclick="runCode()">▶️ Run Code</button>');
                doc.write('</div>');
                doc.write('<div id="output" class="output" style="display: none;"></div>');
                doc.write('<pre id="code" class="code-display"></pre>');
                doc.close();

                // Set code after document is closed to avoid template literal issues
                win.document.getElementById('code').textContent = code;

                // Add script functionality
                win.LANGUAGE = language;
                win.API_ORIGIN = window.location.origin;
                win.runCode = async function() {
                    const code = win.document.getElementById('code').textContent;
                    const args = win.document.getElementById('args').value;
                    const stdin = win.document.getElementById('stdin').value;
                    const outputDiv = win.document.getElementById('output');

                    try {
                        const response = await fetch(win.API_ORIGIN + '/api/execute', {
                            method: 'POST',
                            headers: {'Content-Type': 'application/json'},
                            body: JSON.stringify({
                                code: code,
                                language: win.LANGUAGE,
                                args: args,
                                stdin: stdin,
                                timeout: 30
                            })
                        });

                        const data = await response.json();
                        outputDiv.style.display = 'block';
                        let html = '';

                        html += '<div style="color: #a0a0a0; margin-bottom: 0.75rem; font-size: 0.875rem;"><strong>Executed:</strong> ';
                        if (win.LANGUAGE === 'python') {
                            html += 'python script.py ' + args;
                        } else if (win.LANGUAGE === 'rust') {
                            html += 'cargo run -- ' + args;
                        } else {
                            html += win.LANGUAGE + ' ' + args;
                        }
                        html += '</div>';

                        if (data.stdout) {
                            html += '<div style="color: #4ade80; margin-bottom: 0.5rem;"><strong>Output:</strong></div>';
                            html += '<pre style="margin: 0; color: #e0e0e0;">' + data.stdout + '</pre>';
                        }

                        if (data.stderr) {
                            if (html) html += '<div style="margin: 1rem 0; border-top: 1px solid #3a3a3a;"></div>';
                            html += '<div style="color: #f87171; margin-bottom: 0.5rem;"><strong>Errors:</strong></div>';
                            html += '<pre style="margin: 0; color: #f87171;">' + data.stderr + '</pre>';
                        }

                        if (!data.stdout && !data.stderr) {
                            html = '<div style="color: #a0a0a0;">No output</div>';
                        }

                        outputDiv.innerHTML = html;
                    } catch (error) {
                        outputDiv.style.display = 'block';
                        outputDiv.innerHTML = '<div style="color: #f87171;"><strong>Error:</strong> ' + error.message + '</div>';
                    }
                };
            }
        }

        // Set leaderboard preference
        async function setLeaderboardPreference(modelName, runId) {
            try {
                await fetch(`/api/leaderboard/preferences/${encodeURIComponent(modelName)}`, {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({run_id: runId})
                });
                await viewModelDetailsForRun(modelName, runId);
            } catch (error) {
                showError('Failed to set preference: ' + error.message);
            }
        }

        // Clear leaderboard preference
        async function clearLeaderboardPreference(modelName) {
            try {
                await fetch(`/api/leaderboard/preferences/${encodeURIComponent(modelName)}`, {
                    method: 'DELETE'
                });
                await viewModelDetailsUnified(modelName);
            } catch (error) {
                showError('Failed to clear preference: ' + error.message);
            }
        }

        // Toggle collapsible section
        function toggleSection(id) {
            const content = document.getElementById(id);
            const toggle = document.getElementById(id + '-toggle');
            if (content.classList.contains('open')) {
                content.classList.remove('open');
                toggle.textContent = '[+]';
            } else {
                content.classList.add('open');
                toggle.textContent = '[-]';
            }
        }

        // Escape HTML
        function escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
        }

        // Show loading
        function showLoading() {
            document.getElementById('loadingMessage').style.display = 'block';
            document.getElementById('mainContent').style.display = 'none';
            document.getElementById('errorMessage').style.display = 'none';
        }

        // Show error
        function showError(message) {
            const errorDiv = document.getElementById('errorMessage');
            errorDiv.innerHTML = '<div class="error"><strong>Error:</strong> ' + escapeHtml(message) + '</div>';
            errorDiv.style.display = 'block';
            document.getElementById('loadingMessage').style.display = 'none';
        }
