#!/usr/bin/env python3
"""
Quick verification script to check if the benchmark system is properly set up.
Run this after installation to verify everything is working.

Usage:
    python verify_setup.py
"""
import sys
from pathlib import Path

# Add current directory to path (same as run.py)
sys.path.insert(0, str(Path(__file__).parent))

def check_imports():
    """Check if all required imports work."""
    print("=" * 60)
    print("LLM Benchmark Setup Verification")
    print("=" * 60)
    print()

    errors = []

    # Check core dependencies
    print("Checking core dependencies...")
    try:
        import yaml
        print("  [OK] PyYAML")
    except ImportError:
        errors.append("PyYAML not installed: pip install PyYAML")
        print("  [MISSING] PyYAML")

    try:
        import pydantic
        print("  [OK] Pydantic")
    except ImportError:
        errors.append("Pydantic not installed: pip install pydantic")
        print("  [MISSING] Pydantic")

    try:
        from dotenv import load_dotenv
        print("  [OK] python-dotenv")
    except ImportError:
        errors.append("python-dotenv not installed: pip install python-dotenv")
        print("  [MISSING] python-dotenv")

    try:
        import rich
        print("  [OK] rich")
    except ImportError:
        errors.append("rich not installed: pip install rich")
        print("  [MISSING] rich")

    try:
        import fastapi
        print("  [OK] FastAPI")
    except ImportError:
        errors.append("FastAPI not installed: pip install fastapi")
        print("  [MISSING] FastAPI")

    try:
        import uvicorn
        print("  [OK] uvicorn")
    except ImportError:
        errors.append("uvicorn not installed: pip install uvicorn")
        print("  [MISSING] uvicorn")

    print()

    # Check LLM client library
    print("Checking LLM client library...")
    try:
        from lib.rotator_library.client import RotatingClient
        print("  [OK] rotator_library (from local lib/)")
    except ImportError as e:
        errors.append(f"rotator_library not installed: pip install -e lib/rotator_library")
        print(f"  [MISSING] rotator_library: {e}")

    print()

    # Check project structure
    print("Checking project structure...")
    required_dirs = [
        "src",
        "src/evaluators",
        "questions",
        "viewer",
        "viewer/templates",
        "lib",
        "lib/rotator_library"
    ]

    for dir_path in required_dirs:
        path = Path(dir_path)
        if path.exists():
            print(f"  [OK] {dir_path}/")
        else:
            errors.append(f"Missing directory: {dir_path}/")
            print(f"  [MISSING] {dir_path}/")

    print()

    # Check configuration files
    print("Checking configuration files...")
    required_files = [
        "config.yaml",
        "requirements.txt",
        "run.py",
        "viewer/server.py"
    ]

    for file_path in required_files:
        path = Path(file_path)
        if path.exists():
            print(f"  [OK] {file_path}")
        else:
            errors.append(f"Missing file: {file_path}")
            print(f"  [MISSING] {file_path}")

    print()

    # Check questions
    print("Checking questions...")
    import glob
    import json

    question_files = list(Path("questions").rglob("*.json"))
    total_questions = 0

    if question_files:
        for qfile in question_files:
            try:
                with open(qfile) as f:
                    data = json.load(f)
                    count = len(data)
                    total_questions += count
                    print(f"  [OK] {qfile.parent.name}/{qfile.name} ({count} questions)")
            except Exception as e:
                errors.append(f"Error reading {qfile}: {e}")
                print(f"  [ERROR] {qfile}: {e}")
    else:
        errors.append("No question files found in questions/")
        print("  [ERROR] No question files found")

    print(f"\n  Total: {total_questions} questions")

    print()
    print("=" * 60)

    # Summary
    if errors:
        print("[FAIL] SETUP INCOMPLETE - Issues found:")
        print()
        for error in errors:
            print(f"  - {error}")
        print()
        print("Please fix the issues above and run this script again.")
        return False
    else:
        print("[SUCCESS] SETUP COMPLETE - All checks passed!")
        print()
        print("You're ready to run the benchmark:")
        print("  python run.py")
        print()
        print("To view results:")
        print("  python viewer/server.py")
        return True

if __name__ == "__main__":
    success = check_imports()
    sys.exit(0 if success else 1)
