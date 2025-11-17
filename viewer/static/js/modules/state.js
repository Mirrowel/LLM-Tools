/**
 * State Management Module
 * Manages application state including leaderboard data, navigation history, and cache
 */

// Leaderboard state
export let leaderboardData = null;
export let currentModel = null;
export let currentModelRuns = [];

// Navigation state
export let navigationHistory = []; // Stack of {view: string, data: object}
export let currentView = {view: 'home', data: {}};

// Client-side cache for bulk data
export let dataCache = {
    runs: {}, // run_id -> bulk data
    currentRunId: null,
    currentModelName: null
};

// Async operations tracker
export let activeOperations = new Map(); // operation_id -> {type, status, startTime}
export let operationCounter = 0;

// State setters
export function setLeaderboardData(data) {
    leaderboardData = data;
}

export function setCurrentModel(model) {
    currentModel = model;
}

export function setCurrentModelRuns(runs) {
    currentModelRuns = runs;
}

export function pushNavigationHistory(view) {
    navigationHistory.push({...currentView});
    currentView = view;
}

export function popNavigationHistory() {
    if (navigationHistory.length === 0) return null;
    const previousView = navigationHistory.pop();
    currentView = previousView;
    return previousView;
}

export function clearNavigationHistory() {
    navigationHistory = [];
    currentView = {view: 'home', data: {}};
}

export function updateDataCache(runId, modelName, data) {
    const cacheKey = `${runId}_${modelName}`;
    dataCache.runs[cacheKey] = data;
    dataCache.currentRunId = runId;
    dataCache.currentModelName = modelName;
}

export function getDataFromCache(runId, modelName) {
    const cacheKey = `${runId}_${modelName}`;
    return dataCache.runs[cacheKey];
}

export function clearCacheEntry(runId, modelName) {
    const cacheKey = `${runId}_${modelName}`;
    delete dataCache.runs[cacheKey];
}

export function nextOperationId() {
    return ++operationCounter;
}
