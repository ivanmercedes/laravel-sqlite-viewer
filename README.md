# Laravel SQLite Viewer

A powerful VS Code extension for viewing and managing SQLite databases with advanced features like inline editing, auto-refresh, and intelligent database discovery.

## Usage

### Opening a Database

**Method 1: Find Databases Command**
1. Open Command Palette (Ctrl+Shift+P / Cmd+Shift+P)
2. Type "SQLite: Find SQLite Databases"
3. Select a database from the list

**Method 2: File Explorer**
1. Right-click any .sqlite, .db, or .sqlite3 file
2. Select "Open with SQLite Viewer"

### Viewing Data

1. Select a table from the Schema Explorer sidebar
2. Browse data in the main panel
3. Use pagination controls to navigate large tables

### Editing Data

1. Click the "Edit Mode" toggle button in the header
2. Read the warning and confirm
3. Double-click any cell to edit (except primary keys)
4. Press Enter to save or Escape to cancel

### Running Queries

1. Switch to the "SQL Runner" tab
2. Write your SQL query
3. Click "Execute" or press Ctrl+Enter
4. View results in the data grid below

### Auto-Refresh

1. Click the "Auto-Refresh" toggle button
2. When another app or process modifies the database, the UI updates automatically
3. Perfect for monitoring databases that change frequently

## Features

**Database Viewing**
- Browse SQLite databases directly in VS Code
- Schema explorer with tables, columns, types, and constraints
- Paginated data viewing for large datasets
- Primary key and foreign key visualization
- Virtual scrolling for smooth performance with 100k+ rows

**Data Editing**
- Double-click cells to edit values inline
- Automatic primary key detection
- Safe updates with WHERE clause validation
- Visual feedback for editable vs read-only columns

**SQL Runner**
- Execute custom SQL queries
- Syntax highlighting and validation
- Read-only mode for safe exploration
- Edit mode for data modifications
- Paginated query results

**Auto-Refresh**
- Monitor database file for external changes
- Automatic UI updates when data changes
- 500ms debouncing to prevent excessive reloads
- Toggle on/off with header button

**Database Discovery**
- Recursively search workspace for SQLite files
- Verify files by SQLite header signature
- QuickPick interface for easy database selection
- Support for .sqlite, .db, and .sqlite3 extensions

**Safety Features**
- Read-only by default
- Explicit edit mode activation required
- Visual warning banner when edit mode is active
- Primary key required for inline editing
- Query classification (READ/WRITE/SCHEMA)
- Parameterized queries prevent SQL injection

## Performance

**Virtual Scrolling**
- Renders only 10-20 visible rows at a time
- Smooth scrolling with 100,000+ row tables
- Constant memory usage regardless of table size

**Optimized Queries**
- Always paginated (LIMIT/OFFSET)
- No full table scans
- Efficient primary key lookups

## License

MIT

## Credits

Developed by Ivan Mercedes

## Support

For issues and feature requests, please use the GitHub issue tracker at https://github.com/ivanmercedes/laravel-sqlite-viewer
