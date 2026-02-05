// Get DOM elements
const inputText = document.getElementById('inputText');
const outputText = document.getElementById('outputText');
const errorMsg = document.getElementById('errorMsg');
const clearBtn = document.getElementById('clearBtn');
const copyBtn = document.getElementById('copyBtn');
const compactBtn = document.getElementById('compactBtn');
const formatBtn = document.getElementById('formatBtn');
const searchInput = document.getElementById('searchInput');
const searchCount = document.getElementById('searchCount');
const searchPrev = document.getElementById('searchPrev');
const searchNext = document.getElementById('searchNext');

// Current format mode
let isCompact = false;

// Search related variables
let searchMatches = [];
let currentMatchIndex = -1;

// Listen for input changes
inputText.addEventListener('input', () => {
  parseJSON();
  // Auto search if there is search content after input change
  if (searchInput.value.trim()) {
    performSearch();
  }
});

// Clear button
clearBtn.addEventListener('click', () => {
  inputText.value = '';
  outputText.textContent = '';
  hideError();
  inputText.focus();
});

// Copy button
copyBtn.addEventListener('click', () => {
  const text = outputText.textContent;
  if (text) {
    navigator.clipboard.writeText(text).then(() => {
      showCopySuccess();
    }).catch(err => {
      console.error('Copy failed:', err);
    });
  }
});

// Compact button
compactBtn.addEventListener('click', () => {
  isCompact = true;
  outputText.innerHTML = '';  // Clear output to force fresh render
  parseJSON();
});

// Format button (expand)
formatBtn.addEventListener('click', () => {
  isCompact = false;
  outputText.innerHTML = '';  // Clear output to force fresh render
  parseJSON();
});

// Search input
searchInput.addEventListener('input', () => {
  performSearch();
});

// Search navigation buttons
searchPrev.addEventListener('click', () => {
  navigateSearch(-1);
});

searchNext.addEventListener('click', () => {
  navigateSearch(1);
});

// Search box enter key
searchInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    if (e.shiftKey) {
      navigateSearch(-1);
    } else {
      navigateSearch(1);
    }
  }
});

// Parse JSON
function parseJSON() {
  let input = inputText.value.trim();

  if (!input) {
    outputText.textContent = '';
    hideError();
    return;
  }

  // First try to parse escaped strings (like "{\n  \"key\": \"value\"\n}")
  // This must be done before removing invalid characters, otherwise leading quotes will be incorrectly removed
  input = tryParseJsonString(input);

  // Try to convert Python dict format (single quotes) to JSON format
  input = tryParsePythonDict(input);

  // Auto remove leading invalid characters, find the first { or [
  if (input.charAt(0) !== '{' && input.charAt(0) !== '[') {
    const firstBraceIndex = input.indexOf('{');
    const firstBracketIndex = input.indexOf('[');

    let startIndex = -1;

    if (firstBraceIndex !== -1 && firstBracketIndex !== -1) {
      // Both exist, take the earlier position
      startIndex = Math.min(firstBraceIndex, firstBracketIndex);
    } else if (firstBraceIndex !== -1) {
      startIndex = firstBraceIndex;
    } else if (firstBracketIndex !== -1) {
      startIndex = firstBracketIndex;
    }

    if (startIndex > 0) {
      // Found valid start position, remove leading characters
      input = input.substring(startIndex);
    }
  }

  // Auto remove trailing invalid characters, find the last } or ]
  const lastChar = input.charAt(input.length - 1);
  if (lastChar !== '}' && lastChar !== ']') {
    const lastBraceIndex = input.lastIndexOf('}');
    const lastBracketIndex = input.lastIndexOf(']');

    let endIndex = -1;

    if (lastBraceIndex !== -1 && lastBracketIndex !== -1) {
      // Both exist, take the later position
      endIndex = Math.max(lastBraceIndex, lastBracketIndex);
    } else if (lastBraceIndex !== -1) {
      endIndex = lastBraceIndex;
    } else if (lastBracketIndex !== -1) {
      endIndex = lastBracketIndex;
    }

    if (endIndex !== -1 && endIndex < input.length - 1) {
      // Found valid end position, remove trailing characters
      input = input.substring(0, endIndex + 1);
    }
  }

  try {
    // Try to parse JSON
    let parsed = JSON.parse(input);

    // Recursively parse nested serialized JSON strings
    parsed = deepParseJSON(parsed);

    // Format output based on mode
    let formatted;
    if (isCompact) {
      formatted = JSON.stringify(parsed);
    } else {
      formatted = JSON.stringify(parsed, null, 2);
    }

    // Apply syntax highlighting and collapse functionality
    outputText.innerHTML = syntaxHighlightWithCollapse(formatted);
    hideError();

    // Bind collapse events
    bindCollapseEvents();

  } catch (error) {
    // Try to show the text with error highlighting
    showErrorWithHighlight(input, error);
  }
}

// Try to parse JSON formatted string (with escape characters)
function tryParseJsonString(input) {
  // Check if it starts and ends with quotes (might be a JSON string)
  if (input.startsWith('"') && input.endsWith('"')) {
    try {
      // Try to parse this string with JSON.parse
      const parsed = JSON.parse(input);
      if (typeof parsed === 'string') {
        return parsed;
      }
    } catch (e) {
      // Parse failed, return original input
    }
  }

  // Check if it contains escape characters (like \n, \", \t, etc.) and looks like JSON
  if (input.includes('\\n') || input.includes('\\t') || input.includes('\\"')) {
    // Try to directly replace escape characters
    try {
      let unescaped = input
        .replace(/\\n/g, '\n')
        .replace(/\\t/g, '\t')
        .replace(/\\r/g, '\r')
        .replace(/\\"/g, '"')
        .replace(/\\\\/g, '\\');

      // Remove leading and trailing quotes (if any)
      if (unescaped.startsWith('"') && unescaped.endsWith('"')) {
        unescaped = unescaped.slice(1, -1);
      }

      // Validate if it's valid JSON
      JSON.parse(unescaped);
      return unescaped;
    } catch (e) {
      // Parse failed, return original input
    }
  }

  return input;
}

// Try to convert Python dict format to JSON format
function tryParsePythonDict(input) {
  // Check if it looks like Python dict (contains single quotes)
  if (!input.includes("'")) {
    return input;
  }

  try {
    // First try to parse as-is (might already be valid JSON)
    JSON.parse(input);
    return input;
  } catch (e) {
    // Not valid JSON, try to convert from Python format
  }

  // Convert single quotes to double quotes using a state machine
  let result = '';
  let inString = false;
  let stringChar = null;
  let i = 0;

  while (i < input.length) {
    const char = input[i];
    const nextChar = i < input.length - 1 ? input[i + 1] : '';
    const prevResultChar = result.length > 0 ? result[result.length - 1] : '';

    if (!inString) {
      if (char === "'" || char === '"') {
        inString = true;
        stringChar = char;
        result += '"';  // Always use double quotes
      } else if (char === 'T' && input.substr(i, 4) === 'True') {
        const before = i > 0 ? input[i - 1] : ' ';
        const after = input[i + 4] || ' ';
        if (!/[a-zA-Z0-9_]/.test(before) && !/[a-zA-Z0-9_]/.test(after)) {
          result += 'true';
          i += 4;
          continue;
        }
        result += char;
      } else if (char === 'F' && input.substr(i, 5) === 'False') {
        const before = i > 0 ? input[i - 1] : ' ';
        const after = input[i + 5] || ' ';
        if (!/[a-zA-Z0-9_]/.test(before) && !/[a-zA-Z0-9_]/.test(after)) {
          result += 'false';
          i += 5;
          continue;
        }
        result += char;
      } else if (char === 'N' && input.substr(i, 4) === 'None') {
        const before = i > 0 ? input[i - 1] : ' ';
        const after = input[i + 4] || ' ';
        if (!/[a-zA-Z0-9_]/.test(before) && !/[a-zA-Z0-9_]/.test(after)) {
          result += 'null';
          i += 4;
          continue;
        }
        result += char;
      } else {
        result += char;
      }
    } else {
      // Inside a string
      if (char === '\\') {
        // Handle escape sequences
        if (nextChar === stringChar) {
          // Escaped quote: \' or \"
          result += (stringChar === "'") ? '"' : '\\"';
          i += 2;
          continue;
        } else if (nextChar === '"' && stringChar === "'") {
          // \" in single-quoted string - this is literal backslash + quote
          // In JSON we need: \\\" (escaped backslash + escaped quote)
          result += '\\\\\\"';
          i += 2;
          continue;
        } else if (nextChar === '\\') {
          // Escaped backslash
          result += '\\\\';
          i += 2;
          continue;
        } else {
          // Other escape sequences (\n, \t, etc.) - keep as-is
          result += char;
        }
      } else if (char === stringChar) {
        // End of string (unescaped quote)
        inString = false;
        stringChar = null;
        result += '"';
      } else if (char === '"' && stringChar === "'") {
        // Unescaped double quote inside single-quoted string needs escaping for JSON
        result += '\\"';
      } else {
        result += char;
      }
    }
    i++;
  }

  // Try to validate, but return converted result anyway (for error highlighting)
  try {
    JSON.parse(result);
  } catch (e) {
    // Conversion produced invalid JSON, but still return it
    // so error highlighting can show where the problem is
  }

  return result;
}

// Recursively parse nested JSON strings
function deepParseJSON(obj) {
  if (typeof obj === 'string') {
    // Try to parse if string is JSON
    const trimmed = obj.trim();
    if ((trimmed.startsWith('{') && trimmed.endsWith('}')) ||
        (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
      try {
        const parsed = JSON.parse(obj);
        // Recursively parse
        return deepParseJSON(parsed);
      } catch (e) {
        // Not valid JSON string, return original value
        return obj;
      }
    }
    return obj;
  } else if (Array.isArray(obj)) {
    // Recursively process array
    return obj.map(item => deepParseJSON(item));
  } else if (obj !== null && typeof obj === 'object') {
    // Recursively process object
    const result = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        result[key] = deepParseJSON(obj[key]);
      }
    }
    return result;
  }
  // Return other types directly
  return obj;
}

// JSON syntax highlighting (with collapse functionality)
function syntaxHighlightWithCollapse(json) {
  const lines = json.split('\n');
  let result = '';
  let lineId = 0;
  const stack = []; // Track nesting levels
  const lineMap = {}; // Record start and end positions of each line

  // First pass: find all start and end lines
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    const isObjectStart = trimmed.endsWith('{');
    const isArrayStart = trimmed.endsWith('[');
    const isObjectEnd = trimmed.startsWith('}');
    const isArrayEnd = trimmed.startsWith(']');

    if (isObjectStart || isArrayStart) {
      const id = lineId++;
      stack.push({ id, startLine: i });
      lineMap[i] = { id, type: 'start' };
    } else if (isObjectEnd || isArrayEnd) {
      if (stack.length > 0) {
        const parent = stack.pop();
        lineMap[parent.startLine].endLine = i;
        lineMap[i] = { id: parent.id, type: 'end', startLine: parent.startLine };
      }
    }
  }

  // Second pass: generate HTML
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    const indent = line.match(/^\s*/)[0];

    let highlightedLine = line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    // Apply syntax highlighting
    highlightedLine = highlightedLine.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, function (match) {
      let cls = 'json-number';

      if (/^"/.test(match)) {
        if (/:$/.test(match)) {
          cls = 'json-key';
        } else {
          cls = 'json-string';
        }
      } else if (/true|false/.test(match)) {
        cls = 'json-boolean';
      } else if (/null/.test(match)) {
        cls = 'json-null';
      }

      return '<span class="' + cls + '">' + match + '</span>';
    });

    // Add collapse button if it's the start of an object or array
    if (lineMap[i] && lineMap[i].type === 'start') {
      const id = lineMap[i].id;
      const endLine = lineMap[i].endLine;
      const toggleBtn = `<span class="json-toggle expanded" data-id="${id}" data-start="${i}" data-end="${endLine}"></span>`;
      highlightedLine = indent + toggleBtn + highlightedLine.substring(indent.length);
      result += `<div class="json-line" data-line="${i}" data-block-id="${id}">${highlightedLine}</div>`;
    } else {
      result += `<div class="json-line" data-line="${i}">${highlightedLine}</div>`;
    }
  }

  return result;
}

// Bind collapse events
function bindCollapseEvents() {
  const toggles = outputText.querySelectorAll('.json-toggle');

  toggles.forEach(toggle => {
    toggle.addEventListener('click', function(e) {
      e.stopPropagation();
      const startLine = parseInt(this.getAttribute('data-start'));
      const endLine = parseInt(this.getAttribute('data-end'));
      const isExpanded = this.classList.contains('expanded');

      if (isExpanded) {
        // Collapse
        this.classList.remove('expanded');
        this.classList.add('collapsed');

        // Hide all lines from startLine+1 to endLine
        const allLines = outputText.querySelectorAll('.json-line');
        allLines.forEach(line => {
          const lineNum = parseInt(line.getAttribute('data-line'));
          if (lineNum > startLine && lineNum <= endLine) {
            line.style.display = 'none';
          }
        });

        // Add ellipsis after collapse button
        const line = this.parentElement;
        const lineText = line.textContent.trim();
        const isObject = lineText.includes('{');
        const ellipsis = document.createElement('span');
        ellipsis.className = 'json-ellipsis';
        ellipsis.textContent = isObject ? ' {...}' : ' [...]';
        ellipsis.setAttribute('data-ellipsis-for', startLine);
        line.appendChild(ellipsis);

      } else {
        // Expand
        this.classList.remove('collapsed');
        this.classList.add('expanded');

        // Show all lines from startLine+1 to endLine
        const allLines = outputText.querySelectorAll('.json-line');
        allLines.forEach(line => {
          const lineNum = parseInt(line.getAttribute('data-line'));
          if (lineNum > startLine && lineNum <= endLine) {
            // Only show direct children, not those hidden by other collapse blocks
            const shouldShow = !isLineHiddenByParent(lineNum, startLine, endLine);
            if (shouldShow) {
              line.style.display = 'block';
            }
          }
        });

        // Remove ellipsis
        const ellipsis = outputText.querySelector(`[data-ellipsis-for="${startLine}"]`);
        if (ellipsis) {
          ellipsis.remove();
        }
      }
    });
  });
}

// Check if a line is hidden by parent collapse block
function isLineHiddenByParent(lineNum, currentStart, currentEnd) {
  const allToggles = outputText.querySelectorAll('.json-toggle.collapsed');

  for (let toggle of allToggles) {
    const start = parseInt(toggle.getAttribute('data-start'));
    const end = parseInt(toggle.getAttribute('data-end'));

    // If this collapse block is not the one currently being expanded, and contains the target line
    if (start !== currentStart && start < lineNum && lineNum <= end && start > currentStart && end < currentEnd) {
      return true;
    }
  }

  return false;
}

// Show error message
function showError(message) {
  errorMsg.textContent = '❌ JSON Parse Error: ' + message;
  errorMsg.classList.add('show');
}

// Hide error message
function hideError() {
  errorMsg.classList.remove('show');
}

// Show error with highlighted position in the text
function showErrorWithHighlight(input, error) {
  // Try to extract error position from error message
  let errorPos = -1;
  const posMatch = error.message.match(/position\s+(\d+)/i);
  if (posMatch) {
    errorPos = parseInt(posMatch[1]);
  }

  // Format with error marker inserted at the right position
  let formatted = formatInvalidJsonWithError(input, errorPos);

  // Escape HTML
  let html = formatted
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Replace error markers with HTML
  html = html.replace(/\x00ERROR_START\x00(.)\x00ERROR_END\x00/g,
    '<span class="json-error-char">$1</span>');
  html = html.replace(/\x00ERROR_REST_START\x00/g,
    '<span class="json-error-rest">');
  html = html.replace(/\x00ERROR_REST_END\x00/g, '</span>');

  // Apply basic syntax highlighting (avoid matching inside error spans)
  html = html.replace(/("(?:[^"\\]|\\.)*")\s*:/g, '<span class="json-key">$1</span>:');
  html = html.replace(/:(\s*)("(?:[^"\\]|\\.)*")/g, ':$1<span class="json-string">$2</span>');
  html = html.replace(/('(?:[^'\\]|\\.)*')\s*:/g, '<span class="json-key-invalid">$1</span>:');
  html = html.replace(/:(\s*)('(?:[^'\\]|\\.)*')/g, ':$1<span class="json-string-invalid">$2</span>');

  // Wrap in lines
  const lines = html.split('\n');
  let result = lines.map((line, i) =>
    `<div class="json-line" data-line="${i}">${line || '&nbsp;'}</div>`
  ).join('');

  outputText.innerHTML = result;
  showError(error.message);
}

// Format invalid JSON with error position markers
function formatInvalidJsonWithError(input, errorPos) {
  let result = '';
  let indent = 0;
  let inString = false;
  let stringChar = null;
  let errorInserted = false;
  let afterError = false;

  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    const prevChar = i > 0 ? input[i - 1] : '';

    // Insert error marker at error position
    if (i === errorPos && errorPos >= 0) {
      result += '\x00ERROR_START\x00' + char + '\x00ERROR_END\x00';
      result += '\x00ERROR_REST_START\x00';
      errorInserted = true;
      afterError = true;

      // Still need to handle string state
      if (!inString && (char === '"' || char === "'")) {
        inString = true;
        stringChar = char;
      } else if (inString && char === stringChar && prevChar !== '\\') {
        inString = false;
        stringChar = null;
      }
      continue;
    }

    if (!inString) {
      if (char === '"' || char === "'") {
        inString = true;
        stringChar = char;
        result += char;
      } else if (char === '{' || char === '[') {
        indent++;
        result += char + '\n' + '  '.repeat(indent);
      } else if (char === '}' || char === ']') {
        indent = Math.max(0, indent - 1);
        result += '\n' + '  '.repeat(indent) + char;
      } else if (char === ',') {
        result += char + '\n' + '  '.repeat(indent);
      } else if (char === ':') {
        result += ': ';
      } else if (char !== ' ' && char !== '\n' && char !== '\r' && char !== '\t') {
        result += char;
      } else if (result.length > 0) {
        const lastChar = result[result.length - 1];
        if (lastChar !== ' ' && lastChar !== '\n' && char === ' ') {
          result += char;
        }
      }
    } else {
      result += char;
      if (char === stringChar && prevChar !== '\\') {
        inString = false;
        stringChar = null;
      }
    }
  }

  // Close error rest span if it was opened
  if (afterError) {
    result += '\x00ERROR_REST_END\x00';
  }

  return result;
}

// Show copy success toast
function showCopySuccess() {
  const toast = document.createElement('div');
  toast.className = 'copy-success';
  toast.textContent = '✓ Copied to clipboard';
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 2000);
}

// Resizer drag functionality
const resizer = document.getElementById('resizer');
const leftPanel = document.getElementById('leftPanel');
const rightPanel = document.getElementById('rightPanel');

let isResizing = false;

resizer.addEventListener('mousedown', (e) => {
  isResizing = true;
  document.body.style.cursor = 'col-resize';
  document.body.style.userSelect = 'none';
});

document.addEventListener('mousemove', (e) => {
  if (!isResizing) return;

  const containerWidth = document.querySelector('.content').offsetWidth;
  const leftWidth = e.clientX;
  const leftPercentage = (leftWidth / containerWidth) * 100;

  // Limit min and max width
  if (leftPercentage >= 20 && leftPercentage <= 80) {
    leftPanel.style.width = leftPercentage + '%';
    // Save to local storage
    localStorage.setItem('jsonFormatterLeftPanelWidth', leftPercentage);
  }
});

document.addEventListener('mouseup', () => {
  if (isResizing) {
    isResizing = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }
});

// On page load
window.addEventListener('load', () => {
  // Restore saved width
  const savedWidth = localStorage.getItem('jsonFormatterLeftPanelWidth');
  if (savedWidth) {
    leftPanel.style.width = savedWidth + '%';
  }

  // Auto focus input
  inputText.focus();
});

// Perform search
function performSearch() {
  const searchTerm = searchInput.value.trim();

  // Clear previous highlights
  clearSearchHighlights();

  if (!searchTerm) {
    searchCount.textContent = '';
    searchPrev.disabled = true;
    searchNext.disabled = true;
    searchMatches = [];
    currentMatchIndex = -1;
    return;
  }

  // Get plain text content of output
  const lines = outputText.querySelectorAll('.json-line');
  searchMatches = [];

  lines.forEach((line, lineIndex) => {
    const text = line.textContent;
    const lowerText = text.toLowerCase();
    const lowerSearch = searchTerm.toLowerCase();

    let index = 0;
    while ((index = lowerText.indexOf(lowerSearch, index)) !== -1) {
      searchMatches.push({
        lineElement: line,
        lineIndex: lineIndex,
        startIndex: index,
        endIndex: index + searchTerm.length
      });
      index += searchTerm.length;
    }
  });

  // Update search count
  if (searchMatches.length > 0) {
    searchCount.textContent = `${searchMatches.length} results`;
    searchPrev.disabled = false;
    searchNext.disabled = false;

    // Highlight all matches
    highlightSearchMatches(searchTerm);

    // Auto jump to first match
    currentMatchIndex = 0;
    scrollToMatch(0);
  } else {
    searchCount.textContent = 'No results';
    searchPrev.disabled = true;
    searchNext.disabled = true;
    currentMatchIndex = -1;
  }
}

// Highlight search matches
function highlightSearchMatches(searchTerm) {
  const lines = outputText.querySelectorAll('.json-line');
  const lowerSearch = searchTerm.toLowerCase();

  lines.forEach(line => {
    const html = line.innerHTML;
    // Extract plain text for search
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    const text = tempDiv.textContent;
    const lowerText = text.toLowerCase();

    // If contains search term, rebuild HTML
    if (lowerText.includes(lowerSearch)) {
      let newHtml = html;
      const regex = new RegExp(`(${escapeRegExp(searchTerm)})`, 'gi');

      // Only replace in text nodes, avoid breaking HTML tags
      newHtml = newHtml.replace(/>([^<]+)</g, (match, textContent) => {
        const highlighted = textContent.replace(regex, '<mark class="search-highlight">$1</mark>');
        return `>${highlighted}<`;
      });

      line.innerHTML = newHtml;
    }
  });
}

// Clear search highlights
function clearSearchHighlights() {
  const highlights = outputText.querySelectorAll('.search-highlight');
  highlights.forEach(mark => {
    const parent = mark.parentNode;
    parent.replaceChild(document.createTextNode(mark.textContent), mark);
    parent.normalize();
  });
}

// Navigate to specified search result
function navigateSearch(direction) {
  if (searchMatches.length === 0) return;

  currentMatchIndex += direction;

  // Circular navigation
  if (currentMatchIndex < 0) {
    currentMatchIndex = searchMatches.length - 1;
  } else if (currentMatchIndex >= searchMatches.length) {
    currentMatchIndex = 0;
  }

  scrollToMatch(currentMatchIndex);

  // Update count display
  searchCount.textContent = `${currentMatchIndex + 1} / ${searchMatches.length}`;
}

// Scroll to specified match
function scrollToMatch(index) {
  if (index < 0 || index >= searchMatches.length) return;

  // Remove previous current highlight
  const prevCurrent = outputText.querySelector('.search-highlight.current');
  if (prevCurrent) {
    prevCurrent.classList.remove('current');
  }

  // Get all highlight elements
  const allHighlights = outputText.querySelectorAll('.search-highlight');
  if (allHighlights[index]) {
    allHighlights[index].classList.add('current');
    allHighlights[index].scrollIntoView({
      behavior: 'smooth',
      block: 'center'
    });
  }
}

// Escape regex special characters
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Support keyboard shortcuts
document.addEventListener('keydown', (e) => {
  // Ctrl/Cmd + K to clear
  if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
    e.preventDefault();
    clearBtn.click();
  }

  // Ctrl/Cmd + F to focus search box
  if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
    e.preventDefault();
    searchInput.focus();
    searchInput.select();
  }

  // Ctrl/Cmd + Enter to format
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault();
    formatBtn.click();
  }

  // Ctrl/Cmd + Shift + C to compact
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'C') {
    e.preventDefault();
    compactBtn.click();
  }

  // F3 or Ctrl/Cmd + G for next search result
  if (e.key === 'F3' || ((e.ctrlKey || e.metaKey) && e.key === 'g')) {
    e.preventDefault();
    if (e.shiftKey) {
      navigateSearch(-1);
    } else {
      navigateSearch(1);
    }
  }
});
