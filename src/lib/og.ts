import { Resvg } from '@resvg/resvg-js';
const escape = (text: string) => text.replace(/[<>&"']/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'}[c]!));
export function wrap(text: string, limit: number, maxLines: number) {
  const lines: string[] = []; let line = '';
  for (const word of text.trim().split(/\s+/)) {
    if (line && (line + ' ' + word).length > limit) { lines.push(line); line = word; }
    else line = line ? line + ' ' + word : word;
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) { lines.length = maxLines; lines[maxLines-1] = lines[maxLines-1].replace(/[.,:;!?—-]+$/, '') + '…'; }
  return lines;
}
export function renderOG(title: string, description: string, tags: string[], date: string) {
  const lines = wrap(title, 36, 4);
  const summary = wrap(description, 76, 2);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#fafafa"/><rect x="64" y="68" width="34" height="4" fill="#2459d3"/>
  <g font-family="DejaVu Sans" fill="#171717">
  <text x="118" y="78" font-size="18" fill="#696969">${escape(tags.join(' / ') || 'Записи')}</text>
  ${lines.map((line, i) => `<text x="64" y="${164+i*72}" font-size="54" font-weight="600" letter-spacing="-1.3">${escape(line)}</text>`).join('')}
  ${summary.map((line,i) => `<text x="64" y="${Math.max(468,164+lines.length*72+14)+i*30}" font-size="21" fill="#696969">${escape(line)}</text>`).join('')}
  <path d="M64 558H1136" stroke="#e4e4e4"/><text x="64" y="594" font-size="17" fill="#696969">${escape(date)}</text>
  </g></svg>`;
  return new Uint8Array(new Resvg(svg, { font: { loadSystemFonts:true, defaultFontFamily:'DejaVu Sans' } }).render().asPng());
}
