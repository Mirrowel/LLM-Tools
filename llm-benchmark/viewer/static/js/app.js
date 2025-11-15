/**
 * MirroBench - Vue.js 3 Application
 * Modern LLM Benchmark Viewer
 */

const { createApp } = Vue;

createApp({
    data() {
        return {
            // Navigation
            currentPage: 'individual',
            pages: [
                { id: 'individual', name: 'Individual Evaluation', icon: 'gauge' },
                { id: 'comparative', name: 'Comparative Judge', icon: 'git-compare' },
                { id: 'human', name: 'Human Judge', icon: 'user' },
                { id: 'authors-choice', name: "Author's Choice", icon: 'star' }
            ],

            // UI State
            loading: false,
            showConfigModal: false,
            toasts: [],

            // Individual Evaluation Data
            leaderboard: [],
            modelDisplayNames: {},
            runs: [],
            questions: [],

            // Comparative Judge Data
            comparativeJobs: [],
            selectedJobResults: null,
            comparativeLoading: false,
            showStartJobModal: false,
            selectedRunsForComparison: [],

            // Human Judge Data
            humanJudgeSelectedRun: null,
            humanJudgeLeaderboard: [],
            humanJudgeQuestions: [],
            humanJudgeLoading: false,
            selectedQuestionForRating: null,
            currentRating: { score: 50, comment: '' },

            // Author's Choice Data
            authorsChoiceRankings: [],
            authorsChoiceLoading: false,

            // Config Editor Data
            configContent: '',
            configErrors: [],
            configSaving: false,
            configBackups: [],
        };
    },

    computed: {
        availableRuns() {
            // Group runs by model
            const runsByModel = {};
            this.runs.forEach(run => {
                if (!runsByModel[run.model]) {
                    runsByModel[run.model] = [];
                }
                runsByModel[run.model].push(run);
            });
            return runsByModel;
        },

        modelsFromRuns() {
            const models = new Set();
            this.runs.forEach(run => models.add(run.model));
            return Array.from(models).sort();
        }
    },

    watch: {
        currentPage(newPage) {
            this.onPageChange(newPage);
        },

        showConfigModal(show) {
            if (show) {
                this.loadConfig();
            }
        }
    },

    mounted() {
        // Load initial data
        this.loadData();

        // Update icons when Vue renders
        this.$nextTick(() => {
            if (window.lucide) {
                lucide.createIcons();
            }
        });
    },

    updated() {
        // Re-initialize icons after any update
        this.$nextTick(() => {
            if (window.lucide) {
                lucide.createIcons();
            }
        });
    },

    methods: {
        // ====================================================================
        // General Data Loading
        // ====================================================================

        async loadData() {
            this.loading = true;
            try {
                await this.loadModelDisplayNames();
                await this.loadLeaderboard();
                await this.loadRuns();
                await this.loadQuestions();
            } catch (error) {
                console.error('Error loading data:', error);
                this.showToast('Failed to load data', 'error');
            } finally {
                this.loading = false;
            }
        },

        async loadLeaderboard() {
            try {
                const response = await fetch('/api/leaderboard/unified');
                const data = await response.json();
                this.leaderboard = data.leaderboard || [];
            } catch (error) {
                console.error('Error loading leaderboard:', error);
                this.leaderboard = [];
            }
        },

        async loadModelDisplayNames() {
            try {
                const response = await fetch('/api/model-display-names');
                const data = await response.json();
                this.modelDisplayNames = data.model_display_names || {};
            } catch (error) {
                console.error('Error loading display names:', error);
                this.modelDisplayNames = {};
            }
        },

        async loadRuns() {
            try {
                const response = await fetch('/api/runs');
                const data = await response.json();
                this.runs = data.runs || [];
            } catch (error) {
                console.error('Error loading runs:', error);
                this.runs = [];
            }
        },

        async loadQuestions() {
            try {
                const response = await fetch('/api/questions');
                const data = await response.json();
                this.questions = data.questions || [];
            } catch (error) {
                console.error('Error loading questions:', error);
                this.questions = [];
            }
        },

        async refreshData() {
            this.showToast('Refreshing data...', 'success');
            await this.loadData();
        },

        getDisplayName(modelName) {
            return this.modelDisplayNames[modelName] || modelName;
        },

        getScoreColor(score) {
            if (score >= 80) return 'text-green-400';
            if (score >= 60) return 'text-yellow-400';
            return 'text-red-400';
        },

        // ====================================================================
        // Page Change Handler
        // ====================================================================

        async onPageChange(page) {
            switch (page) {
                case 'comparative':
                    await this.loadComparativeJobs();
                    break;
                case 'human':
                    await this.loadHumanJudgeData();
                    break;
                case 'authors-choice':
                    await this.loadAuthorsChoice();
                    break;
            }
        },

        // ====================================================================
        // Individual Evaluation Page
        // ====================================================================

        viewModelDetails(entry) {
            this.showToast('Model details view coming soon', 'success');
        },

        // ====================================================================
        // Comparative Judge Page
        // ====================================================================

        async loadComparativeJobs() {
            this.comparativeLoading = true;
            try {
                const response = await fetch('/api/comparative-judge/jobs');
                const data = await response.json();
                this.comparativeJobs = data.jobs || [];
            } catch (error) {
                console.error('Error loading comparative jobs:', error);
                this.comparativeJobs = [];
            } finally {
                this.comparativeLoading = false;
            }
        },

        openStartJobModal() {
            this.showStartJobModal = true;
            this.selectedRunsForComparison = [];
        },

        closeStartJobModal() {
            this.showStartJobModal = false;
        },

        toggleRunSelection(runId) {
            const index = this.selectedRunsForComparison.indexOf(runId);
            if (index > -1) {
                this.selectedRunsForComparison.splice(index, 1);
            } else {
                this.selectedRunsForComparison.push(runId);
            }
        },

        async startComparativeJob() {
            if (this.selectedRunsForComparison.length < 2) {
                this.showToast('Please select at least 2 runs to compare', 'error');
                return;
            }

            try {
                const response = await fetch('/api/comparative-judge/start', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        run_ids: this.selectedRunsForComparison
                    })
                });

                const data = await response.json();
                this.showToast('Comparative judging started', 'success');
                this.closeStartJobModal();
                await this.loadComparativeJobs();

                // Start polling for this job
                this.pollJobStatus(data.job_id);

            } catch (error) {
                console.error('Error starting job:', error);
                this.showToast('Failed to start comparative judging', 'error');
            }
        },

        async pollJobStatus(jobId) {
            const poll = async () => {
                try {
                    const response = await fetch(`/api/comparative-judge/jobs/${jobId}/status`);
                    const job = await response.json();

                    // Update job in list
                    const index = this.comparativeJobs.findIndex(j => j.job_id === jobId);
                    if (index > -1) {
                        this.$set(this.comparativeJobs, index, job);
                    }

                    // Continue polling if still running
                    if (job.status === 'running' || job.status === 'pending') {
                        setTimeout(poll, 2000);
                    } else if (job.status === 'completed') {
                        this.showToast('Comparative judging completed', 'success');
                    }
                } catch (error) {
                    console.error('Error polling job status:', error);
                }
            };

            poll();
        },

        async viewJobResults(jobId) {
            try {
                const response = await fetch(`/api/comparative-judge/jobs/${jobId}/results`);
                const data = await response.json();
                this.selectedJobResults = data;
            } catch (error) {
                console.error('Error loading job results:', error);
                this.showToast('Failed to load results', 'error');
            }
        },

        closeJobResults() {
            this.selectedJobResults = null;
        },

        // ====================================================================
        // Human Judge Page
        // ====================================================================

        async loadHumanJudgeData() {
            this.humanJudgeLoading = true;
            try {
                if (this.runs.length > 0 && !this.humanJudgeSelectedRun) {
                    this.humanJudgeSelectedRun = this.runs[0].run_id;
                }

                if (this.humanJudgeSelectedRun) {
                    await this.loadHumanJudgeLeaderboard();
                    await this.loadHumanJudgeQuestions();
                }
            } catch (error) {
                console.error('Error loading human judge data:', error);
            } finally {
                this.humanJudgeLoading = false;
            }
        },

        async loadHumanJudgeLeaderboard() {
            if (!this.humanJudgeSelectedRun) return;

            try {
                const response = await fetch(`/api/runs/${this.humanJudgeSelectedRun}/human-ratings/leaderboard`);
                const data = await response.json();
                this.humanJudgeLeaderboard = data.leaderboard || [];
            } catch (error) {
                console.error('Error loading human judge leaderboard:', error);
                this.humanJudgeLeaderboard = [];
            }
        },

        async loadHumanJudgeQuestions() {
            if (!this.humanJudgeSelectedRun) return;

            try {
                const run = this.runs.find(r => r.run_id === this.humanJudgeSelectedRun);
                if (!run) return;

                // Get all responses for this run
                const response = await fetch(`/api/runs/${this.humanJudgeSelectedRun}/bulk-data?model_name=${run.model}`);
                const data = await response.json();

                this.humanJudgeQuestions = Object.keys(data.responses || {}).map(qid => ({
                    id: qid,
                    ...data.questions[qid],
                    response: data.responses[qid],
                    rating: null
                }));

                // Load existing ratings
                for (const q of this.humanJudgeQuestions) {
                    const ratingResponse = await fetch(`/api/runs/${this.humanJudgeSelectedRun}/human-ratings/${run.model}/${q.id}`);
                    const ratingData = await ratingResponse.json();
                    q.rating = ratingData.rating;
                }

            } catch (error) {
                console.error('Error loading human judge questions:', error);
                this.humanJudgeQuestions = [];
            }
        },

        openRatingModal(question) {
            this.selectedQuestionForRating = question;
            this.currentRating = {
                score: question.rating?.score || 50,
                comment: question.rating?.comment || ''
            };
        },

        closeRatingModal() {
            this.selectedQuestionForRating = null;
        },

        async saveRating() {
            if (!this.selectedQuestionForRating) return;

            try {
                const run = this.runs.find(r => r.run_id === this.humanJudgeSelectedRun);
                if (!run) return;

                const response = await fetch(
                    `/api/runs/${this.humanJudgeSelectedRun}/human-ratings/${run.model}/${this.selectedQuestionForRating.id}`,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(this.currentRating)
                    }
                );

                const data = await response.json();
                this.showToast('Rating saved', 'success');
                this.closeRatingModal();

                // Reload data
                await this.loadHumanJudgeLeaderboard();
                await this.loadHumanJudgeQuestions();

            } catch (error) {
                console.error('Error saving rating:', error);
                this.showToast('Failed to save rating', 'error');
            }
        },

        // ====================================================================
        // Author's Choice Page
        // ====================================================================

        async loadAuthorsChoice() {
            this.authorsChoiceLoading = true;
            try {
                const response = await fetch('/api/authors-choice');
                const data = await response.json();

                // If no rankings exist, create default from models
                if (!data.rankings || data.rankings.length === 0) {
                    this.authorsChoiceRankings = this.modelsFromRuns.map((model, index) => ({
                        model_name: model,
                        position: index + 1
                    }));
                } else {
                    this.authorsChoiceRankings = data.rankings;
                }

                // Initialize sortable
                this.$nextTick(() => {
                    this.initializeSortable();
                });

            } catch (error) {
                console.error('Error loading author\'s choice:', error);
                this.authorsChoiceRankings = [];
            } finally {
                this.authorsChoiceLoading = false;
            }
        },

        initializeSortable() {
            const el = document.getElementById('sortable-rankings');
            if (!el || !window.Sortable) return;

            Sortable.create(el, {
                animation: 150,
                handle: '.drag-handle',
                onEnd: () => {
                    // Update positions after drag
                    const items = Array.from(el.children);
                    this.authorsChoiceRankings = items.map((item, index) => ({
                        model_name: item.dataset.modelName,
                        position: index + 1
                    }));
                }
            });
        },

        async saveAuthorsChoice() {
            this.authorsChoiceLoading = true;
            try {
                const response = await fetch('/api/authors-choice', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        rankings: this.authorsChoiceRankings
                    })
                });

                const data = await response.json();
                this.showToast('Rankings saved', 'success');

            } catch (error) {
                console.error('Error saving rankings:', error);
                this.showToast('Failed to save rankings', 'error');
            } finally {
                this.authorsChoiceLoading = false;
            }
        },

        resetAuthorsChoice() {
            this.authorsChoiceRankings = this.modelsFromRuns.map((model, index) => ({
                model_name: model,
                position: index + 1
            }));
        },

        // ====================================================================
        // Config Editor Modal
        // ====================================================================

        async loadConfig() {
            try {
                const response = await fetch('/api/config');
                const data = await response.json();
                this.configContent = data.content || '';

                // Initialize CodeMirror if not already initialized
                this.$nextTick(() => {
                    this.initializeCodeMirror();
                });

                // Load backups
                await this.loadConfigBackups();

            } catch (error) {
                console.error('Error loading config:', error);
                this.showToast('Failed to load config', 'error');
            }
        },

        initializeCodeMirror() {
            const textarea = document.getElementById('config-editor');
            if (!textarea || !window.CodeMirror) return;

            // Check if already initialized
            if (textarea.nextSibling && textarea.nextSibling.classList && textarea.nextSibling.classList.contains('CodeMirror')) {
                return;
            }

            const editor = CodeMirror.fromTextArea(textarea, {
                mode: 'yaml',
                theme: 'dracula',
                lineNumbers: true,
                indentUnit: 2,
                tabSize: 2,
                lineWrapping: true,
                viewportMargin: Infinity,
            });

            // Set editor height
            editor.setSize(null, '500px');

            editor.on('change', (cm) => {
                this.configContent = cm.getValue();
            });

            // Store editor instance
            this.configEditor = editor;
        },

        async validateConfig() {
            try {
                const response = await fetch('/api/config/validate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        yaml_content: this.configContent
                    })
                });

                const data = await response.json();

                if (data.valid) {
                    this.configErrors = [];
                    this.showToast('Config is valid', 'success');
                } else {
                    this.configErrors = data.errors || [];
                    this.showToast('Config validation failed', 'error');
                }

            } catch (error) {
                console.error('Error validating config:', error);
                this.showToast('Validation error', 'error');
            }
        },

        async saveConfig() {
            // Validate first
            await this.validateConfig();

            if (this.configErrors.length > 0) {
                this.showToast('Please fix validation errors before saving', 'error');
                return;
            }

            this.configSaving = true;
            try {
                const response = await fetch('/api/config/save', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        yaml_content: this.configContent
                    })
                });

                const data = await response.json();
                this.showToast(data.message || 'Config saved', 'success');

                // Reload backups
                await this.loadConfigBackups();

            } catch (error) {
                console.error('Error saving config:', error);
                this.showToast('Failed to save config', 'error');
            } finally {
                this.configSaving = false;
            }
        },

        async loadConfigBackups() {
            try {
                const response = await fetch('/api/config/backups');
                const data = await response.json();
                this.configBackups = data.backups || [];
            } catch (error) {
                console.error('Error loading backups:', error);
                this.configBackups = [];
            }
        },

        async restoreConfigBackup(backupName) {
            if (!confirm(`Restore config from ${backupName}?`)) return;

            try {
                const response = await fetch(`/api/config/restore/${backupName}`, {
                    method: 'POST'
                });

                const data = await response.json();
                this.showToast(data.message, 'success');

                // Reload config
                await this.loadConfig();

            } catch (error) {
                console.error('Error restoring backup:', error);
                this.showToast('Failed to restore backup', 'error');
            }
        },

        // ====================================================================
        // Toast Notifications
        // ====================================================================

        showToast(message, type = 'success') {
            const id = Date.now();
            this.toasts.push({ id, message, type });

            setTimeout(() => {
                this.toasts = this.toasts.filter(t => t.id !== id);
            }, 3000);
        },
    }
}).mount('#app');
