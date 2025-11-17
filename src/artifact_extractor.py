"""
Artifact extractor for multi-file web applications.
Handles extracting and serving multiple files from model responses.
"""
import re
import tempfile
import shutil
from pathlib import Path
from typing import Dict, Optional, Tuple, List


class ArtifactExtractor:
    """Extract and manage multi-file artifacts from model responses."""

    def __init__(self, temp_base_dir: Optional[str] = None):
        self.temp_base_dir = Path(temp_base_dir) if temp_base_dir else Path(tempfile.gettempdir()) / "llm_bench_artifacts"
        self.temp_base_dir.mkdir(exist_ok=True, parents=True)

    def extract_multi_file_artifact(self, response_text: str, artifact_id: str) -> Optional[Dict]:
        """
        Extract multiple files from response and create directory structure.

        Supports two formats:
        1. Filename hints in comments before code blocks:
           <!-- filename: index.html -->
           ```html
           ...
           ```

        2. Explicit filename markers:
           ```html:index.html
           ...
           ```

        Returns:
            Dict with:
            - type: 'multi_file' or 'single_file'
            - entry_point: Main file (usually index.html)
            - files: Dict of filename -> content
            - directory: Path to temp directory
        """
        files = self._extract_files_from_response(response_text)

        if not files:
            return None

        # Determine if multi-file or single-file
        is_multi_file = len(files) > 1 or any('import' in content or 'require(' in content for content in files.values())

        if is_multi_file:
            # Create temporary directory for this artifact
            artifact_dir = self.temp_base_dir / artifact_id
            artifact_dir.mkdir(exist_ok=True, parents=True)

            # Write all files
            for filename, content in files.items():
                file_path = artifact_dir / filename
                file_path.parent.mkdir(exist_ok=True, parents=True)
                file_path.write_text(content, encoding='utf-8')

            # Determine entry point
            entry_point = self._determine_entry_point(files)

            return {
                'type': 'multi_file',
                'entry_point': entry_point,
                'files': files,
                'directory': str(artifact_dir),
                'file_count': len(files)
            }
        else:
            # Single file - return combined HTML
            filename, content = list(files.items())[0]
            return {
                'type': 'single_file',
                'entry_point': filename,
                'files': files,
                'content': content
            }

    def _extract_files_from_response(self, text: str) -> Dict[str, str]:
        """
        Extract files from response text.
        Supports multiple filename hint formats.
        """
        files = {}

        # Format 1: Filename in code block language tag
        # ```html:index.html
        pattern1 = r'```(\w+):([^\n]+)\n(.*?)```'
        matches1 = re.findall(pattern1, text, re.DOTALL)
        for lang, filename, code in matches1:
            filename = filename.strip()
            files[filename] = code.strip()

        # Format 2: HTML/XML comment before code block
        # <!-- filename: index.html -->
        # ```html
        pattern2 = r'<!--\s*(?:filename|file):\s*([^\n]+?)\s*-->\s*```(?:\w+)?\n(.*?)```'
        matches2 = re.findall(pattern2, text, re.DOTALL | re.IGNORECASE)
        for filename, code in matches2:
            filename = filename.strip()
            files[filename] = code.strip()

        # Format 3: Comment-style markers
        # // filename: app.js
        # ```javascript
        pattern3 = r'(?://|#|/\*)\s*(?:filename|file):\s*([^\n]+?)(?:\*/|)\s*\n\s*```(?:\w+)?\n(.*?)```'
        matches3 = re.findall(pattern3, text, re.DOTALL | re.IGNORECASE)
        for filename, code in matches3:
            filename = filename.strip()
            files[filename] = code.strip()

        # Format 4: Markdown heading before code block
        # ### index.html
        # ```html
        pattern4 = r'#{1,6}\s+([^\n]+\.(?:html|js|css|json|jsx|tsx|ts))\s*\n\s*```(?:\w+)?\n(.*?)```'
        matches4 = re.findall(pattern4, text, re.DOTALL | re.IGNORECASE)
        for filename, code in matches4:
            filename = filename.strip()
            files[filename] = code.strip()

        # If no filenames found, try to infer from code blocks
        if not files:
            files = self._infer_files_from_blocks(text)

        return files

    def _infer_files_from_blocks(self, text: str) -> Dict[str, str]:
        """
        Infer filenames when no explicit hints provided.
        Uses heuristics based on content and order.
        """
        files = {}

        pattern = r'```(\w+)?\n(.*?)```'
        matches = re.findall(pattern, text, re.DOTALL)

        html_count = 0
        css_count = 0
        js_count = 0

        for lang, code in matches:
            lang = lang.lower() if lang else ''
            code = code.strip()

            # HTML files
            if lang in ['html', 'htm'] or '<html' in code.lower() or '<!DOCTYPE' in code:
                filename = 'index.html' if html_count == 0 else f'page{html_count}.html'
                files[filename] = code
                html_count += 1

            # CSS files
            elif lang == 'css':
                filename = 'styles.css' if css_count == 0 else f'styles{css_count}.css'
                files[filename] = code
                css_count += 1

            # JavaScript files
            elif lang in ['javascript', 'js', 'jsx']:
                # Check if it's a module (has import/export)
                if 'export ' in code or 'import ' in code:
                    filename = 'app.js' if js_count == 0 else f'module{js_count}.js'
                else:
                    filename = 'script.js' if js_count == 0 else f'script{js_count}.js'
                files[filename] = code
                js_count += 1

            # TypeScript files
            elif lang in ['typescript', 'ts', 'tsx']:
                filename = f'app{js_count if js_count > 0 else ""}.ts'
                files[filename] = code
                js_count += 1

            # JSON files
            elif lang == 'json':
                filename = 'config.json'
                files[filename] = code

        return files

    def _determine_entry_point(self, files: Dict[str, str]) -> str:
        """Determine the main entry point file."""
        # Priority: index.html > any .html > first file
        if 'index.html' in files:
            return 'index.html'

        html_files = [f for f in files.keys() if f.endswith('.html')]
        if html_files:
            return html_files[0]

        # No HTML? Return first file
        return list(files.keys())[0]

    def cleanup_artifact(self, artifact_id: str):
        """Clean up temporary directory for an artifact."""
        artifact_dir = self.temp_base_dir / artifact_id
        if artifact_dir.exists():
            shutil.rmtree(artifact_dir)

    def cleanup_old_artifacts(self, max_age_hours: int = 24):
        """Clean up artifacts older than specified hours."""
        import time
        current_time = time.time()
        max_age_seconds = max_age_hours * 3600

        for artifact_dir in self.temp_base_dir.iterdir():
            if artifact_dir.is_dir():
                age = current_time - artifact_dir.stat().st_mtime
                if age > max_age_seconds:
                    shutil.rmtree(artifact_dir)


def combine_files_for_single_html(files: Dict[str, str]) -> str:
    """
    Fallback: Combine multiple files into single HTML.
    Used when multi-file serving is not available.
    """
    html_content = None
    css_content = []
    js_content = []

    for filename, content in files.items():
        if filename.endswith('.html'):
            html_content = content
        elif filename.endswith('.css'):
            css_content.append(content)
        elif filename.endswith('.js') or filename.endswith('.jsx'):
            js_content.append(content)

    if not html_content:
        # No HTML - create wrapper
        html_content = """<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body>
    <div id="root"></div>
</body>
</html>"""

    # Inject CSS
    if css_content:
        css = '\n'.join(css_content)
        style_tag = f'<style>\n{css}\n</style>'
        if '</head>' in html_content:
            html_content = html_content.replace('</head>', f'{style_tag}\n</head>')

    # Inject JS
    if js_content:
        js = '\n'.join(js_content)
        script_tag = f'<script type="module">\n{js}\n</script>'
        if '</body>' in html_content:
            html_content = html_content.replace('</body>', f'{script_tag}\n</body>')

    return html_content
