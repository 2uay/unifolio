#!/usr/bin/env node
// Render every policy markdown doc in docs/ to a print-quality PDF.
// Output: docs/policies-pdf/<name>.pdf
//
// Usage:  npm run policies:pdf

import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';

const POLICIES = [
  { src: 'docs/INFOSEC_POLICY.md',          name: 'Unifolio_Information_Security_Policy.pdf',     title: 'Information Security Policy' },
  { src: 'docs/ACCESS_CONTROLS_POLICY.md',  name: 'Unifolio_Access_Controls_Policy.pdf',          title: 'Access Controls Policy' },
  { src: 'docs/DATA_RETENTION_POLICY.md',   name: 'Unifolio_Data_Retention_and_Disposal_Policy.pdf', title: 'Data Retention and Disposal Policy' },
  { src: 'docs/PRIVACY_POLICY.md',          name: 'Unifolio_Privacy_Policy.pdf',                  title: 'Privacy Policy' },
  { src: 'docs/CONSUMER_MFA_RATIONALE.md',  name: 'Unifolio_Consumer_MFA_Rationale.pdf',          title: 'Consumer MFA Rationale and Compensating Controls' },
];

const OUT_DIR = path.resolve('docs/policies-pdf');

// ─── Tiny markdown → HTML converter ────────────────────────────────────────
// Handles: # / ## / ### headers, **bold**, *italic*, `code`, links, lists,
// tables, horizontal rules, and paragraphs. Good enough for our policy docs.

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function renderInline(s) {
  let out = escapeHtml(s);
  // links [text](url)
  out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, t, u) => `<a href="${u}">${t}</a>`);
  // bold **x**
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  // italic *x*  (after bold so **x** isn't matched here)
  out = out.replace(/(?<!\w)\*([^*]+)\*(?!\w)/g, '<em>$1</em>');
  // inline code `x`
  out = out.replace(/`([^`]+)`/g, '<code>$1</code>');
  return out;
}

function renderTable(lines) {
  // First line = header, second = separator, rest = rows.
  const rows = lines.map(l => l.replace(/^\||\|$/g, '').split('|').map(c => c.trim()));
  const header = rows[0];
  const body = rows.slice(2);
  return `<table>
    <thead><tr>${header.map(c => `<th>${renderInline(c)}</th>`).join('')}</tr></thead>
    <tbody>${body.map(r => `<tr>${r.map(c => `<td>${renderInline(c)}</td>`).join('')}</tr>`).join('')}</tbody>
  </table>`;
}

function mdToHtml(md) {
  const lines = md.split('\n');
  const out = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    // Horizontal rule
    if (/^---+$/.test(line.trim())) { out.push('<hr/>'); i++; continue; }

    // Headers
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) { const n = h[1].length; out.push(`<h${n}>${renderInline(h[2])}</h${n}>`); i++; continue; }

    // Tables (start with | and next line has |---)
    if (line.startsWith('|') && lines[i + 1] && /^\|[\s\-|:]+\|$/.test(lines[i + 1])) {
      const tbl = [];
      while (i < lines.length && lines[i].startsWith('|')) { tbl.push(lines[i]); i++; }
      out.push(renderTable(tbl));
      continue;
    }

    // Unordered list
    if (/^\s*[-•]\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*[-•]\s+/.test(lines[i])) {
        items.push(`<li>${renderInline(lines[i].replace(/^\s*[-•]\s+/, ''))}</li>`);
        i++;
      }
      out.push(`<ul>${items.join('')}</ul>`);
      continue;
    }

    // Ordered list
    if (/^\s*\d+\.\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(`<li>${renderInline(lines[i].replace(/^\s*\d+\.\s+/, ''))}</li>`);
        i++;
      }
      out.push(`<ol>${items.join('')}</ol>`);
      continue;
    }

    // Code block
    if (line.startsWith('```')) {
      const code = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) { code.push(escapeHtml(lines[i])); i++; }
      i++; // closing fence
      out.push(`<pre><code>${code.join('\n')}</code></pre>`);
      continue;
    }

    // Blank line
    if (line.trim() === '') { i++; continue; }

    // Paragraph (gather contiguous non-empty non-special lines)
    const para = [line];
    i++;
    while (i < lines.length
        && lines[i].trim() !== ''
        && !lines[i].startsWith('#')
        && !lines[i].startsWith('|')
        && !/^\s*[-•]\s+/.test(lines[i])
        && !/^\s*\d+\.\s+/.test(lines[i])
        && !lines[i].startsWith('```')
        && !/^---+$/.test(lines[i].trim())) {
      para.push(lines[i]);
      i++;
    }
    out.push(`<p>${para.map(renderInline).join('<br/>')}</p>`);
  }
  return out.join('\n');
}

// ─── PDF stylesheet ────────────────────────────────────────────────────────

const STYLE = `
  @page { size: Letter; margin: 0.85in 0.75in; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
    font-size: 10.5pt;
    line-height: 1.55;
    color: #111;
    margin: 0;
  }
  h1 { font-size: 22pt; margin: 0 0 6pt; color: #000; border-bottom: 2px solid #000; padding-bottom: 6pt; }
  h2 { font-size: 14pt; margin: 18pt 0 6pt; color: #000; border-bottom: 1px solid #ccc; padding-bottom: 3pt; }
  h3 { font-size: 12pt; margin: 14pt 0 4pt; color: #000; }
  h4 { font-size: 11pt; margin: 12pt 0 3pt; color: #222; }
  p, ul, ol { margin: 6pt 0; }
  ul, ol { padding-left: 22pt; }
  li { margin: 2pt 0; }
  hr { border: none; border-top: 1px solid #ddd; margin: 16pt 0; }
  a { color: #1d4ed8; text-decoration: underline; }
  code {
    font-family: 'SFMono-Regular', 'Consolas', 'Menlo', monospace;
    font-size: 9pt;
    background: #f3f3f3;
    padding: 1pt 4pt;
    border-radius: 3pt;
    color: #b91c1c;
  }
  pre {
    background: #f8f8f8;
    border: 1px solid #e5e5e5;
    border-radius: 4pt;
    padding: 8pt 10pt;
    overflow-x: auto;
    font-size: 9pt;
  }
  pre code { background: transparent; padding: 0; color: #111; }
  table {
    width: 100%;
    border-collapse: collapse;
    margin: 8pt 0 12pt;
    font-size: 9.5pt;
  }
  th, td {
    border: 1px solid #d0d0d0;
    padding: 5pt 7pt;
    text-align: left;
    vertical-align: top;
  }
  th { background: #f5f5f5; font-weight: 600; color: #000; }
  tr:nth-child(even) td { background: #fafafa; }
  strong { color: #000; }
  .footer {
    position: fixed;
    bottom: 0.4in;
    left: 0;
    right: 0;
    text-align: center;
    font-size: 8pt;
    color: #888;
  }
`;

const META_FOOTER = (title) => `<div class="footer">${title} · Unifolio Inc. · Generated ${new Date().toISOString().slice(0,10)} · Canonical version: github.com/2uay/unifolio</div>`;

function htmlDocument(title, body) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>${STYLE}</style></head><body>${body}${META_FOOTER(title)}</body></html>`;
}

// ─── Main ──────────────────────────────────────────────────────────────────

await fs.mkdir(OUT_DIR, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext();
const page = await ctx.newPage();

console.log(`Rendering ${POLICIES.length} policies to ${OUT_DIR}/`);

for (const policy of POLICIES) {
  try {
    const md = await fs.readFile(path.resolve(policy.src), 'utf-8');
    const html = htmlDocument(policy.title, mdToHtml(md));
    await page.setContent(html, { waitUntil: 'load' });
    const outPath = path.join(OUT_DIR, policy.name);
    await page.pdf({
      path: outPath,
      format: 'Letter',
      printBackground: true,
      margin: { top: '0.85in', bottom: '0.85in', left: '0.75in', right: '0.75in' },
      displayHeaderFooter: false,
    });
    const stat = await fs.stat(outPath);
    console.log(`  ✓ ${policy.name.padEnd(58)} ${(stat.size / 1024).toFixed(0)} KB`);
  } catch (err) {
    console.error(`  ✗ ${policy.src} failed:`, err?.message || err);
  }
}

await browser.close();
console.log('\nDone. PDFs are ready in docs/policies-pdf/.');
