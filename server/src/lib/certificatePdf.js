import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const NOTO_PATH = path.join(__dirname, '../../assets/fonts/NotoSans-Regular.ttf');

/** Reuse one browser — faster for repeated PDFs under load */
let browserPromise = null;

function getBrowser() {
  if (!browserPromise) {
    browserPromise = puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });
  }
  return browserPromise;
}

/** Optional: call on graceful shutdown in index.js */
export async function closeCertificateBrowser() {
  if (!browserPromise) return;
  const p = browserPromise;
  browserPromise = null;
  try {
    const browser = await p;
    await browser.close();
  } catch {
    /* ignore */
  }
}

function escapeHtml(text) {
  if (text == null || text === '') return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function loadFontDataUrl() {
  if (!fs.existsSync(NOTO_PATH)) {
    throw new Error(`Certificate font missing. Expected: ${NOTO_PATH}`);
  }
  const b64 = fs.readFileSync(NOTO_PATH).toString('base64');
  return `data:font/ttf;base64,${b64}`;
}

/**
 * @param {{ studentName: string, titleLine: string, scopeLine?: string | null, dateLine: string }} opts
 * @returns {string}
 */
function buildCertificateHtml(opts, fontDataUrl) {
  const { studentName, titleLine, scopeLine, dateLine } = opts;
  const scopeBlock = scopeLine ? `<p class="scope">${escapeHtml(scopeLine)}</p>` : '';

  return `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8"/>
<style>
@font-face {
  font-family: 'CertNoto';
  src: url('${fontDataUrl}') format('truetype');
  font-weight: normal;
  font-style: normal;
  font-display: block;
}
* { box-sizing: border-box; margin: 0; padding: 0; }
body {
  font-family: 'CertNoto', 'Segoe UI', system-ui, sans-serif;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
  color: #0f172a;
}
.page {
  width: 297mm;
  height: 210mm;
  position: relative;
  background: linear-gradient(155deg, #fdfcfa 0%, #f0f4f8 38%, #e8eef6 72%, #f5f7fb 100%);
  overflow: hidden;
}
.watermark {
  position: absolute;
  left: 50%;
  top: 52%;
  transform: translate(-50%, -50%) rotate(-28deg);
  font-size: 80px;
  font-weight: 700;
  color: rgba(15, 45, 85, 0.045);
  letter-spacing: 0.35em;
  white-space: nowrap;
  pointer-events: none;
  user-select: none;
}
.border-outer {
  position: absolute;
  inset: 11mm;
  border: 2px solid #c5a028;
  border-radius: 4px;
  box-shadow: inset 0 0 0 1px rgba(197, 160, 40, 0.35);
  pointer-events: none;
}
.border-inner {
  position: absolute;
  inset: 14mm;
  border: 1px solid rgba(30, 58, 95, 0.35);
  border-radius: 2px;
  pointer-events: none;
}
.content {
  position: relative;
  z-index: 1;
  height: 100%;
  padding: 15mm 18mm 12mm;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}
.brand {
  font-size: 14px;
  letter-spacing: 0.42em;
  text-transform: uppercase;
  color: #1e4976;
  font-weight: 700;
  margin-bottom: 4mm;
}
.corner {
  position: absolute;
  width: 28px;
  height: 28px;
  border-color: #b8860b;
  border-style: solid;
  opacity: 0.85;
  pointer-events: none;
}
.corner-tl { top: 17mm; left: 17mm; border-width: 3px 0 0 3px; }
.corner-tr { top: 17mm; right: 17mm; border-width: 3px 3px 0 0; }
.corner-bl { bottom: 17mm; left: 17mm; border-width: 0 0 3px 3px; }
.corner-br { bottom: 17mm; right: 17mm; border-width: 0 3px 3px 0; }
h1 {
  font-size: 40px;
  font-weight: 700;
  color: #132447;
  letter-spacing: 0.06em;
  line-height: 1.2;
  margin-bottom: 2.5mm;
  text-transform: uppercase;
}
.subtitle {
  font-size: 17px;
  color: #3d5a80;
  letter-spacing: 0.28em;
  text-transform: uppercase;
  margin-bottom: 6mm;
}
.rule {
  width: 72mm;
  height: 2px;
  background: linear-gradient(90deg, transparent, #c5a028, transparent);
  margin-bottom: 5mm;
}
.label-present {
  font-size: 17px;
  color: #475569;
  margin-bottom: 2.5mm;
}
.name {
  font-size: 36px;
  font-weight: 700;
  color: #0c1929;
  line-height: 1.3;
  margin-bottom: 6mm;
  max-width: 248mm;
}
.course {
  font-size: 21px;
  color: #1e3a5f;
  line-height: 1.5;
  max-width: 252mm;
  margin-bottom: 2.5mm;
}
.scope {
  font-size: 18px;
  color: #475569;
  line-height: 1.45;
  max-width: 252mm;
  margin-bottom: 70mm;
  padding-top: 1.5mm;
}
.footer {
  padding-top: 0;
  margin-top: 0;
  width: 100%;
}
.date {
  font-size: 15px;
  color: #64748b;
  letter-spacing: 0.04em;
  margin-bottom: 3mm;
}
.seal-row {
  display: flex;
  justify-content: center;
  align-items: flex-end;
  gap: 36mm;
  margin-top: 0;
  font-size: 14px;
  color: #64748b;
}
.seal-col { text-align: center; min-width: 48mm; }
.seal-line {
  margin: 0 auto 3mm;
  width: 44mm;
  border-bottom: 1px solid #94a3b8;
}
</style>
</head>
<body>
<div class="page">
  <div class="watermark">EDUSTART</div>
  <div class="border-outer"></div>
  <div class="border-inner"></div>
  <div class="corner corner-tl"></div>
  <div class="corner corner-tr"></div>
  <div class="corner corner-bl"></div>
  <div class="corner corner-br"></div>
  <div class="content">
    <div class="brand">EduStart</div>
    <h1>Chứng chỉ hoàn thành</h1>
    <p class="subtitle">Chứng nhận</p>
    <div class="rule"></div>
    <p class="label-present">Học viên</p>
    <p class="name">${escapeHtml(studentName || 'Học viên')}</p>
    <p class="course">${escapeHtml(titleLine)}</p>
    ${scopeBlock}
    <div class="footer">
      <p class="date">${escapeHtml(dateLine)}</p>
      <div class="seal-row">
        <div class="seal-col">
          <div class="seal-line"></div>
          <span>Ban giám đốc</span>
        </div>
        <div class="seal-col">
          <div class="seal-line"></div>
          <span>Đại diện đào tạo</span>
        </div>
      </div>
    </div>
  </div>
</div>
</body>
</html>`;
}

/**
 * @param {{ studentName: string, titleLine: string, scopeLine?: string | null, dateLine: string }} opts
 * @returns {Promise<Buffer>}
 */
export async function buildCertificatePdfBuffer(opts) {
  const fontDataUrl = loadFontDataUrl();
  const html = buildCertificateHtml(opts, fontDataUrl);
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setContent(html, { waitUntil: 'domcontentloaded' });
    const pdf = await page.pdf({
      format: 'A4',
      landscape: true,
      printBackground: true,
      preferCSSPageSize: false,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
    });
    return Buffer.from(pdf);
  } finally {
    await page.close().catch(() => {});
  }
}
