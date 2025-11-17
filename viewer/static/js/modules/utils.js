/**
 * Utility Functions Module
 * Common utility functions used throughout the application
 */

/**
 * Escape HTML to prevent XSS
 */
export function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/**
 * Show loading indicator
 */
export function showLoading() {
    document.getElementById('loadingMessage').style.display = 'block';
    document.getElementById('mainContent').style.display = 'none';
    document.getElementById('errorMessage').style.display = 'none';
}

/**
 * Show error message
 */
export function showError(message) {
    const errorDiv = document.getElementById('errorMessage');
    errorDiv.innerHTML = '<div class="error"><strong>Error:</strong> ' + escapeHtml(message) + '</div>';
    errorDiv.style.display = 'block';
    document.getElementById('loadingMessage').style.display = 'none';
}

/**
 * Toggle collapsible section
 */
export function toggleSection(id) {
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

/**
 * Render markdown with syntax highlighting
 */
export function renderMarkdown(text) {
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

/**
 * Format markdown (legacy function for compatibility)
 */
export function formatMarkdown(text) {
    return renderMarkdown(text);
}
