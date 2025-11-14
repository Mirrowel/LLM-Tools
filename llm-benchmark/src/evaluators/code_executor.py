"""
Code executor for evaluating generated code.
"""
import subprocess
import tempfile
import os
import re
from datetime import datetime
from pathlib import Path
from typing import Optional, Tuple
from src.schemas import Question, ModelResponse, Evaluation
from src.artifact_extractor import ArtifactExtractor


class CodeExecutor:
    """Execute and evaluate generated code."""

    def __init__(self, timeout: int = 10):
        self.timeout = timeout
        self.artifact_extractor = ArtifactExtractor()

    async def evaluate(self, question: Question, response: ModelResponse) -> Evaluation:
        """
        Evaluate generated code by executing it.

        Args:
            question: The original question
            response: The model's response containing code

        Returns:
            Evaluation: The evaluation result
        """
        if response.error:
            return Evaluation(
                question_id=question.id,
                model_name=response.model_name,                score=0.0,
                passed=False,
                evaluation_type="code_execution",
                reasoning=f"Response failed with error: {response.error}",
                details={"error": response.error},
                timestamp=datetime.now().isoformat()
            )

        # Validate response has text
        if not response.response_text:
            return Evaluation(
                question_id=question.id,
                model_name=response.model_name,
                score=0.0,
                passed=False,
                evaluation_type="code_execution",
                reasoning="Response text is empty or None",
                details={"error": "Empty response"},
                timestamp=datetime.now().isoformat()
            )

        # Check if this is a multi-file artifact first
        artifact_id = f"eval_{question.id}_{response.model_name}".replace('/', '_')
        multi_file_artifact = self.artifact_extractor.extract_multi_file_artifact(
            response.response_text,
            artifact_id
        )

        if multi_file_artifact and multi_file_artifact['type'] == 'multi_file':
            # Multi-file app - validate file structure
            return self._evaluate_multi_file_artifact(question, response, multi_file_artifact)

        # Extract code from response (single file or combined)
        code, language = self._extract_code(response.response_text)

        if not code:
            # Provide detailed error message
            has_triple_backticks = '```' in response.response_text
            response_preview = response.response_text[:200] if response.response_text else "[empty response]"

            error_details = {
                "has_code_fence": has_triple_backticks,
                "response_length": len(response.response_text) if response.response_text else 0,
                "response_preview": response_preview
            }

            reasoning = "No code block found in response. "
            if not response.response_text:
                reasoning += "Response is empty."
            elif has_triple_backticks:
                reasoning += "Response contains ``` but code extraction failed. Check formatting."
            else:
                reasoning += "Response does not contain markdown code blocks (```)."

            return Evaluation(
                question_id=question.id,
                model_name=response.model_name,
                score=0.0,
                passed=False,
                evaluation_type="code_execution",
                reasoning=reasoning,
                details=error_details,
                timestamp=datetime.now().isoformat()
            )

        # Execute code based on language
        if language in ["python", "py"]:
            success, output, error = self._execute_python(code)
        elif language in ["javascript", "js"]:
            success, output, error = self._execute_javascript(code)
        elif language in ["html", "htm"]:
            # For HTML, we just validate it's valid HTML
            success, output, error = self._validate_html(code)
        else:
            return Evaluation(
                question_id=question.id,
                model_name=response.model_name,                score=0.0,
                passed=False,
                evaluation_type="code_execution",
                reasoning=f"Unsupported language: {language}",
                details={"language": language},
                timestamp=datetime.now().isoformat()
            )

        # Calculate score based on execution result
        if success:
            score = 100.0
            reasoning = f"Code executed successfully ({language})"
            passed = True
        else:
            score = 0.0
            reasoning = f"Code execution failed: {error}"
            passed = False

        # Check against expected output if provided
        if success and question.expected_output:
            if question.expected_output.strip() in output.strip():
                score = 100.0
                reasoning = "Code executed successfully and output matches expected"
            else:
                score = 50.0
                reasoning = "Code executed but output doesn't match expected"
                passed = False

        return Evaluation(
            question_id=question.id,
            model_name=response.model_name,            score=score,
            passed=passed,
            evaluation_type="code_execution",
            reasoning=reasoning,
            details={
                "language": language,
                "execution_success": success,
                "output": output[:1000] if output else None,  # Limit output size
                "error": error[:1000] if error else None,
                "code": code[:2000]  # Store code snippet
            },
            timestamp=datetime.now().isoformat()
        )

    def _extract_code(self, text: str) -> Tuple[Optional[str], Optional[str]]:
        """
        Extract code from markdown code blocks.
        Handles multiple blocks and combines them appropriately.

        Returns:
            tuple: (code, language)
        """
        if not text:
            return None, None

        # Try multiple patterns for code blocks
        # Pattern 1: Standard markdown with optional language
        pattern1 = r'```(\w+)?\s*\n(.*?)```'
        # Pattern 2: Code blocks without newline after opening fence
        pattern2 = r'```(\w+)?\s*(.*?)```'

        matches = re.findall(pattern1, text, re.DOTALL)

        # If no matches with pattern1, try pattern2
        if not matches:
            matches = re.findall(pattern2, text, re.DOTALL)

        # Still no matches? Try to find any content that looks like code
        if not matches:
            # Check if entire response looks like HTML
            if '<html' in text.lower() or '<!doctype html' in text.lower():
                return text.strip(), 'html'
            # Check if it looks like Python
            elif 'def ' in text or 'import ' in text or 'class ' in text:
                return text.strip(), 'python'
            # Check if it looks like JavaScript
            elif 'function ' in text or 'const ' in text or 'let ' in text or 'var ' in text:
                return text.strip(), 'javascript'
            return None, None

        # Categorize blocks by language
        html_blocks = []
        css_blocks = []
        js_blocks = []
        python_blocks = []
        other_blocks = []

        for lang, code in matches:
            lang = lang.lower() if lang else ''
            code = code.strip()

            # Skip empty blocks
            if not code:
                continue

            if lang in ['html', 'htm'] or '<html' in code.lower() or '<!DOCTYPE' in code:
                html_blocks.append(code)
            elif lang in ['css']:
                css_blocks.append(code)
            elif lang in ['javascript', 'js']:
                js_blocks.append(code)
            elif lang in ['python', 'py']:
                python_blocks.append(code)
            elif not lang:
                # No language specified - try to infer
                if '<html' in code.lower() or '<!DOCTYPE' in code:
                    html_blocks.append(code)
                elif 'def ' in code or 'import ' in code or 'print(' in code:
                    python_blocks.append(code)
                elif 'function' in code or 'const ' in code or 'let ' in code or 'var ' in code:
                    js_blocks.append(code)
                else:
                    other_blocks.append((lang, code))

        # Priority: HTML (with CSS/JS) > Python > JavaScript > Other

        # If we have HTML blocks, combine with CSS/JS
        if html_blocks:
            # Check if we have a complete HTML document
            for html in html_blocks:
                if '<html' in html.lower() or '<!DOCTYPE' in html.lower():
                    result = html

                    # Inject CSS if present
                    if css_blocks and '<style>' not in html.lower():
                        css_content = '\n'.join(css_blocks)
                        style_tag = f'<style>\n{css_content}\n</style>'
                        if '</head>' in html.lower():
                            result = result.replace('</head>', f'{style_tag}\n</head>')
                        else:
                            result = result.replace('<html>', f'<html>\n<head>\n{style_tag}\n</head>')

                    # Inject JS if present
                    if js_blocks and '<script>' not in html.lower():
                        js_content = '\n'.join(js_blocks)
                        script_tag = f'<script>\n{js_content}\n</script>'
                        if '</body>' in html.lower():
                            result = result.replace('</body>', f'{script_tag}\n</body>')
                        else:
                            result = result + f'\n{script_tag}'

                    return result, 'html'

            # Partial HTML - wrap it
            html_content = '\n'.join(html_blocks)
            css_content = '\n'.join(css_blocks)
            js_content = '\n'.join(js_blocks)

            combined = f"""<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    {'<style>' + css_content + '</style>' if css_content else ''}
</head>
<body>
    {html_content}
    {'<script>' + js_content + '</script>' if js_content else ''}
</body>
</html>"""
            return combined, 'html'

        # Python blocks - combine with newlines
        if python_blocks:
            return '\n\n'.join(python_blocks), 'python'

        # JavaScript blocks - combine with newlines
        if js_blocks:
            return '\n\n'.join(js_blocks), 'javascript'

        # CSS only - wrap in HTML
        if css_blocks:
            css_content = '\n'.join(css_blocks)
            html = f"""<!DOCTYPE html>
<html>
<head>
    <style>{css_content}</style>
</head>
<body>
    <div>Styles loaded</div>
</body>
</html>"""
            return html, 'html'

        # Other - return first block
        if other_blocks:
            return other_blocks[0][1], other_blocks[0][0] or 'unknown'

        return None, None

    def _execute_python(self, code: str) -> Tuple[bool, str, str]:
        """Execute Python code safely in an isolated temp directory."""
        temp_dir = None
        try:
            # Create a temp directory for execution
            temp_dir = tempfile.mkdtemp(prefix='benchmark_exec_')

            # Write code to a file in the temp directory
            temp_file = os.path.join(temp_dir, 'script.py')
            with open(temp_file, 'w', encoding='utf-8') as f:
                f.write(code)

            try:
                # Execute the code with UTF-8 encoding for output
                # Set cwd to temp_dir so files are created there
                result = subprocess.run(
                    ['python', temp_file],
                    capture_output=True,
                    text=True,
                    timeout=self.timeout,
                    encoding='utf-8',
                    errors='replace',  # Replace unencodable characters instead of failing
                    cwd=temp_dir  # Execute in temp directory
                )

                success = result.returncode == 0
                output = result.stdout
                error = result.stderr

                return success, output, error

            finally:
                pass  # Cleanup happens in outer finally

        except subprocess.TimeoutExpired:
            return False, "", f"Execution timed out after {self.timeout} seconds"
        except Exception as e:
            return False, "", str(e)
        finally:
            # Clean up temp directory
            if temp_dir and os.path.exists(temp_dir):
                try:
                    import shutil
                    shutil.rmtree(temp_dir)
                except:
                    pass

    def _execute_javascript(self, code: str) -> Tuple[bool, str, str]:
        """Execute JavaScript code using Node.js in an isolated temp directory."""
        temp_dir = None
        try:
            # Check if node is available
            subprocess.run(['node', '--version'], capture_output=True, check=True)

            # Create a temp directory for execution
            temp_dir = tempfile.mkdtemp(prefix='benchmark_exec_')

            # Write code to a file in the temp directory
            temp_file = os.path.join(temp_dir, 'script.js')
            with open(temp_file, 'w', encoding='utf-8') as f:
                f.write(code)

            try:
                # Execute the code with UTF-8 encoding for output
                # Set cwd to temp_dir so files are created there
                result = subprocess.run(
                    ['node', temp_file],
                    capture_output=True,
                    text=True,
                    timeout=self.timeout,
                    encoding='utf-8',
                    errors='replace',  # Replace unencodable characters instead of failing
                    cwd=temp_dir  # Execute in temp directory
                )

                success = result.returncode == 0
                output = result.stdout
                error = result.stderr

                return success, output, error

            finally:
                pass  # Cleanup happens in outer finally

        except FileNotFoundError:
            return False, "", "Node.js is not installed or not in PATH"
        except subprocess.TimeoutExpired:
            return False, "", f"Execution timed out after {self.timeout} seconds"
        except Exception as e:
            return False, "", str(e)
        finally:
            # Clean up temp directory
            if temp_dir and os.path.exists(temp_dir):
                try:
                    import shutil
                    shutil.rmtree(temp_dir)
                except:
                    pass

    def _validate_html(self, code: str) -> Tuple[bool, str, str]:
        """Validate HTML code (basic validation)."""
        # Basic HTML validation
        required_tags = ['<html', '</html>', '<body', '</body>']

        code_lower = code.lower()
        missing_tags = [tag for tag in required_tags if tag not in code_lower]

        if missing_tags:
            return False, "", f"Missing required HTML tags: {', '.join(missing_tags)}"

        # Check for basic structure
        if code_lower.index('<body') > code_lower.index('</body>'):
            return False, "", "Invalid HTML structure: closing body tag before opening"

        return True, "HTML structure is valid", ""

    def _evaluate_multi_file_artifact(
        self,
        question: Question,
        response: ModelResponse,
        multi_file_artifact: dict
    ) -> Evaluation:
        """
        Evaluate a multi-file web application.
        Checks file structure, linking, and basic validity.
        """
        files = multi_file_artifact['files']
        entry_point = multi_file_artifact['entry_point']

        # Check if expected files exist (if specified in question metadata)
        expected_files = question.metadata.get('expected_files', [])
        missing_files = []
        if expected_files:
            for expected_file in expected_files:
                if expected_file not in files:
                    missing_files.append(expected_file)

        # Basic validation scores
        score_components = []
        issues = []

        # 1. Has entry point HTML file (30 points)
        if entry_point.endswith('.html'):
            score_components.append(30)
        else:
            issues.append("No HTML entry point found")

        # 2. Files are properly linked (30 points)
        if entry_point in files:
            html_content = files[entry_point]
            css_files = [f for f in files.keys() if f.endswith('.css')]
            js_files = [f for f in files.keys() if f.endswith('.js') or f.endswith('.jsx')]

            # Check CSS linking
            css_linked_correctly = True
            for css_file in css_files:
                if css_file not in html_content:
                    css_linked_correctly = False
                    issues.append(f"CSS file '{css_file}' not linked in HTML")

            # Check JS linking
            js_linked_correctly = True
            for js_file in js_files:
                if js_file not in html_content:
                    js_linked_correctly = False
                    issues.append(f"JS file '{js_file}' not linked in HTML")

            if css_linked_correctly and js_linked_correctly:
                score_components.append(30)
            elif css_linked_correctly or js_linked_correctly:
                score_components.append(15)

        # 3. Has required files (20 points)
        if not missing_files:
            score_components.append(20)
        elif len(missing_files) < len(expected_files):
            score_components.append(10)
        else:
            issues.append(f"Missing expected files: {', '.join(missing_files)}")

        # 4. Proper file structure (20 points)
        # Check for reasonable file count and organization
        if 1 < len(files) <= 10:
            score_components.append(20)
        elif len(files) > 10:
            score_components.append(10)
            issues.append("Excessive number of files (>10)")

        # Calculate total score
        total_score = sum(score_components)
        passed = total_score >= 70

        # Build reasoning
        if passed:
            reasoning = f"Multi-file application validated successfully. {len(files)} files generated and properly structured."
        else:
            reasoning = f"Multi-file application has issues: {'; '.join(issues) if issues else 'Score below threshold'}"

        # Cleanup artifact after evaluation
        try:
            artifact_id = f"eval_{question.id}_{response.model_name}".replace('/', '_')
            self.artifact_extractor.cleanup_artifact(artifact_id)
        except:
            pass

        return Evaluation(
            question_id=question.id,
            model_name=response.model_name,
            score=total_score,
            passed=passed,
            evaluation_type="code_execution_multi_file",
            reasoning=reasoning,
            details={
                "file_count": len(files),
                "files": list(files.keys()),
                "entry_point": entry_point,
                "missing_files": missing_files,
                "issues": issues,
                "score_components": score_components
            },
            timestamp=datetime.now().isoformat()
        )
