# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Chrome extension (Manifest V3) for parsing and formatting JSON text. Pure vanilla JavaScript with zero dependencies and no build system.

## Development

**No build step required.** Load the extension directly in Chrome:
1. Navigate to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked" and select this project folder

There are no automated tests, linters, or build tools configured.

## Architecture

- **manifest.json** - Chrome extension manifest (V3). Defines the background service worker and icons.
- **background.js** - Minimal service worker that opens `index.html` in a new tab when the extension icon is clicked.
- **index.html** - Two-panel UI: left panel for JSON input (textarea), right panel for formatted output with controls (format, compact, copy, clear, search).
- **page-script.js** - All application logic (~878 lines). Key subsystems:
  - **Parsing engine**: `parseJSON()` is the entry point. Supports standard JSON, escaped JSON strings (`tryParseJsonString`), and Python dict syntax (`tryParsePythonDict`). `deepParseJSON()` recursively parses nested JSON strings within values.
  - **Rendering**: `syntaxHighlightWithCollapse()` generates HTML with syntax-highlighted, collapsible output. `bindCollapseEvents()` and `isLineHiddenByParent()` manage fold state.
  - **Search**: `performSearch()`, `highlightSearchMatches()`, `navigateSearch()` implement case-insensitive search with circular navigation through results.
  - **Error display**: `showErrorWithHighlight()` and `formatInvalidJsonWithError()` show parse errors with position markers in the output.
  - **UI**: Panel resizing with localStorage persistence, keyboard shortcuts, clipboard copy with toast notification.
- **page-styles.css** - All styling including syntax highlight classes (`.json-key`, `.json-string`, `.json-number`, `.json-boolean`, `.json-null`), error styling, search highlights, and panel layout.

## Code Style

- All comments must be written in English.
