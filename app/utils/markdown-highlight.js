function escHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function renderInline(text) {
  let result = '';
  let i = 0;
  while (i < text.length) {
    if (text[i] === '*') {
      const bold = text[i + 1] === '*';
      const mLen = bold ? 2 : 1;
      const end  = text.indexOf(bold ? '**' : '*', i + mLen);
      if (end !== -1) {
        const content = text.slice(i + mLen, end);
        if (content.length > 0 && !/^\s/.test(content) && !/\s$/.test(content)) {
          // Use colour only — font-weight/style changes glyph widths, causing cursor drift
          const cls = bold ? 'md-b' : 'md-i';
          result += `<span class="${cls}">${escHtml(text.slice(i, end + mLen))}</span>`;
          i = end + mLen;
          continue;
        }
      }
      result += escHtml(text.slice(i, i + mLen));
      i += mLen;
    } else {
      result += escHtml(text[i]);
      i++;
    }
  }
  return result;
}

function renderMarkdown(text) {
  return text.split('\n').map(line => {
    if (/^#{1,6} /.test(line)) return `<span class="md-h">${escHtml(line)}</span>`;
    return renderInline(line);
  }).join('\n');
}

export function attachMarkdownHighlight(textarea, highlightEl) {
  const sync = () => {
    // Safe: all user text passes through escHtml before touching the DOM.
    // The only raw HTML emitted is our own hard-coded <strong>/<em> tags.
    // Trailing space prevents the last empty line from losing height.
    highlightEl.innerHTML = renderMarkdown(textarea.value) + ' '; // safe — see above
  };
  textarea.addEventListener('input', sync);
  sync();
  return {
    sync,
    detach: () => {
      textarea.removeEventListener('input', sync);
    },
  };
}
