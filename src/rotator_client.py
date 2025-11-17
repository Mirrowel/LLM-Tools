"""
Unified import for RotatingClient so both installed package and local lib/ work.

Usage in code:
    from src.rotator_client import RotatingClient

This tries to import the package installed via pip (rotator_library),
and falls back to the local copy under lib/rotator_library if not installed.
"""

try:
    # Prefer local development copy if present
    from lib.rotator_library.client import RotatingClient  # Local development copy
except Exception:
    # Fallback to installed package (via requirements VCS dependency)
    from rotator_library.client import RotatingClient
