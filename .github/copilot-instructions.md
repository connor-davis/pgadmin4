# pgAdmin 4 - Copilot Instructions

## Architecture

pgAdmin 4 is a Flask (Python) + React (JavaScript) web application for managing PostgreSQL databases. It can run as a standalone desktop app (via an Electron runtime in `runtime/`) or as a web server.

**Python backend** (`web/pgadmin/`): A Flask app where every feature is a `PgAdminModule` (subclass of Flask `Blueprint`). Modules are dynamically discovered and registered at startup. The core module hierarchy lives under `web/pgadmin/browser/server_groups/servers/` and mirrors the PostgreSQL object tree (server → database → schema → table, etc.).

**JavaScript frontend** (`web/pgadmin/static/js/` and each module's `static/js/`): React with MUI components. The UI for each database object node is split into two files:
- `<node>.js` — registers the browser tree node (collection, context menus, actions)
- `<node>.ui.js` — exports a `BaseUISchema` subclass that defines the properties dialog form fields

**Versioned SQL templates**: SQL queries are Jinja2 templates stored under `templates/<module>/sql/`. Version-specific variants live in subdirectories named `default/`, `15_plus/`, `16_plus/`, `17_plus/`, etc. The `VersionedTemplateLoader` selects the highest-versioned template that doesn't exceed the connected server's version. Template paths use the `#` separator: `"module/sql#<server_version>#filename.sql"`.

**State management**: Zustand stores for global UI state; React Query (`@tanstack/react-query`) for server data fetching.

**Module alias system**: Webpack and Jest both use aliases defined in `web/webpack.shim.js`. Use these aliases (e.g., `sources/`, `pgadmin.node.<name>`, `pgadmin.tools.<name>`) when importing rather than relative paths where possible.

## Commands

All commands run from the repo root unless noted.

### Setup
```bash
# Install JS dependencies
cd web && yarn install        # or: make install-node

# Install Python dependencies (in a venv)
pip install -r requirements.txt
pip install -r web/regression/requirements.txt  # for tests
```

### Run
```bash
cd web && python pgAdmin4.py
```

### Build JS bundle
```bash
make bundle          # production build
make bundle-dev      # dev build (faster, includes linting)
cd web && yarn run webpacker:watch  # watch mode, no linting
```

### Lint
```bash
make linter          # JS (ESLint)
make check-pep8      # Python (pycodestyle, max 79 chars)
```

### Test

**JavaScript (Jest)** — run from `web/`:
```bash
cd web
yarn run test:js-once                    # full JS test suite (lint + jest)
yarn run jest --testPathPattern <file>   # single test file
yarn run jest -t "<test name pattern>"   # single test by name
```

**Python API tests** — run from `web/`:
```bash
cd web
python regression/runtests.py                          # all (non-feature) tests
python regression/runtests.py --pkg browser.server_groups.servers.databases.tests  # single package
python regression/runtests.py --pkg tools.sqleditor --modules test_start_running_query  # single module
python regression/runtests.py --exclude feature_tests  # exclude Selenium tests
```

**Python feature/Selenium tests** — requires Chrome + chromedriver:
```bash
cd web && python regression/runtests.py --pkg feature_tests
```

### Database migrations
```bash
cd web
FLASK_APP=pgAdmin4.py flask db revision   # create new migration in migrations/versions/
```
After creating a migration, increment `SCHEMA_VERSION` in `web/pgadmin/model/__init__.py`.

## Key Conventions

### Python module structure
Each feature module under `web/pgadmin/` follows this layout:
```
<module>/
  __init__.py          # PgAdminModule subclass + Flask routes (REST API)
  static/js/           # JS for this module
  templates/<module>/  # Jinja2 templates (HTML + SQL)
  tests/               # Python API test cases
```

### JavaScript node pattern
Browser tree nodes always have a paired `<node>.js` + `<node>.ui.js`. The `.ui.js` file exports a class extending `BaseUISchema` from `sources/SchemaView/base_schema.ui` and defines `get baseFields()` returning an array of field descriptors.

### Python API views
Node views extend `PGChildNodeView` (from `pgadmin.browser.utils`). Response helpers from `pgadmin.utils.ajax` must be used: `make_json_response`, `ajax_response`, `internal_server_error`, `gone`, etc. — never return raw `jsonify()` directly.

### Python i18n
Use `from flask_babel import gettext as _` for all user-facing strings in Python. In JS, use `import gettext from 'sources/gettext'`.

### Python style
- PEP 8 enforced via `pycodestyle` with `max-line-length = 79`. Ignores: E402, W504, E231.
- `config_local.py` and `config_distro.py` are excluded from linting.

### JS test files
Jest spec files live in `web/regression/javascript/` (not co-located with source). Files follow `<name>.spec.js` naming. Schema UI specs are under `regression/javascript/schema_ui_files/`.

### Copyright header
Every source file must have the standard pgAdmin copyright header:
```python
##########################################################################
#
# pgAdmin 4 - PostgreSQL Tools
#
# Copyright (C) 2013 - 2026, The pgAdmin Development Team
# This software is released under the PostgreSQL Licence
#
##########################################################################
```
(Use `//` comment style for JS/CSS files.)
