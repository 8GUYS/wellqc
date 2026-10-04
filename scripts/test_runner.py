import os
import sys

project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
venv_site_packages = os.path.join(project_root, ".venv", "Lib", "site-packages")

if os.path.exists(venv_site_packages):
    sys.path.insert(0, venv_site_packages)
if project_root not in sys.path:
    sys.path.insert(0, project_root)

import pytest
exit_code = pytest.main(sys.argv[1:] or [os.path.join(project_root, "backend", "tests")])
sys.exit(exit_code)
