# JSON Format Chrome Plugin

A Chrome extension for parsing and formatting JSON text.

## Features

- **Real-time JSON parsing**: Automatically parses and formats JSON as you type
- **Syntax highlighting**: Color-coded JSON keys, strings, numbers, booleans, and null values
- **Collapsible blocks**: Fold/unfold objects and arrays for better readability
- **Search functionality**: Search within formatted JSON with navigation (up/down)
- **Format modes**: Switch between pretty-print and compact (minified) output
- **Auto-cleanup**: Automatically removes invalid prefix/suffix characters
- **Nested JSON parsing**: Recursively parses nested JSON strings
- **Escape sequence handling**: Handles escaped JSON strings (e.g., `\n`, `\"`)
- **Resizable panels**: Drag to resize input/output panels
- **Keyboard shortcuts**:
  - `Ctrl/Cmd + K`: Clear input
  - `Ctrl/Cmd + F`: Focus search box
  - `Ctrl/Cmd + Enter`: Format (pretty-print)
  - `Ctrl/Cmd + Shift + C`: Compress (compact)
  - `F3` / `Ctrl/Cmd + G`: Next search result
  - `Shift + F3`: Previous search result

## Installation

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" in the top right corner
3. Click "Load unpacked" and select this project folder
4. Click the extension icon to open the JSON formatter in a new tab

## Usage

1. Click the extension icon in Chrome toolbar
2. Paste or type JSON text in the left panel
3. Formatted result appears automatically in the right panel
4. Use buttons to copy, compress, or format the output
5. Use the search box to find specific text in the output

## TODO

- Support Python dict format (single quotes to double quotes conversion)一起