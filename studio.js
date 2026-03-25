#!/usr/bin/env node
// miniFShop Studio — local web UI for building single-product shops
// Usage: node studio.js

'use strict';

const http   = require('http');
const fs     = require('fs');
const path   = require('path');
const os     = require('os');
const crypto = require('crypto');
const { exec } = require('child_process');

const PORT = 3456;

// When running as a pkg binary, __dirname points into the read-only virtual
// snapshot filesystem. Output files (dist/, tmp images) must go to the real
// filesystem. Assets (web/, templates) are read from the snapshot — that's fine.
const IS_PKG   = !!process.pkg;
const WEB_DIR  = path.join(__dirname, 'web');
const DOCS_DIR = path.join(os.homedir(), 'Documents', 'miniFShop');
const DIST_DIR = IS_PKG ? path.join(DOCS_DIR, 'dist') : path.join(__dirname, 'dist');
const TMP_IMG  = path.join(os.tmpdir(), 'minifshop-images');

const CONFIG_DIR  = path.join(os.homedir(), '.minifshop');
const CONFIG_PATH = path.join(CONFIG_DIR, 'config.json');

// Require builder at top level so pkg bundles it correctly
const studioBuilder = require('./studio-builder');

// ── Helpers ───────────────────────────────────────────────────────────────────

function ensureDir(d) { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); }

function mime(ext) {
    return {
        '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript',
        '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.svg': 'image/svg+xml',
        '.zip': 'application/zip', '.ico': 'image/x-icon',
    }[ext] || 'application/octet-stream';
}

function serveFile(res, filePath) {
    if (!fs.existsSync(filePath)) { res.writeHead(404); res.end('Not found'); return; }
    const ext  = path.extname(filePath).toLowerCase();
    const data = fs.readFileSync(filePath);
    res.writeHead(200, { 'Content-Type': mime(ext), 'Content-Length': data.length, 'Cache-Control': 'no-cache, no-store, must-revalidate' });
    res.end(data);
}

function jsonResponse(res, status, obj) {
    const body = JSON.stringify(obj);
    res.writeHead(status, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) });
    res.end(body);
}

function readBody(req) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        req.on('data', c => chunks.push(c));
        req.on('end', () => resolve(Buffer.concat(chunks)));
        req.on('error', reject);
    });
}

function parseMultipart(buffer, boundary) {
    const sep   = Buffer.from('--' + boundary);
    const parts = [];
    let start   = 0;
    while (start < buffer.length) {
        const sepIdx = buffer.indexOf(sep, start);
        if (sepIdx === -1) break;
        const afterSep = sepIdx + sep.length;
        if (buffer.slice(afterSep, afterSep + 2).equals(Buffer.from('--'))) break;
        const headerEnd = buffer.indexOf('\r\n\r\n', afterSep);
        if (headerEnd === -1) break;
        const headerStr = buffer.slice(afterSep + 2, headerEnd).toString();
        const bodyStart = headerEnd + 4;
        const nextSep   = buffer.indexOf('\r\n' + sep.toString(), bodyStart);
        const bodyEnd   = nextSep === -1 ? buffer.length : nextSep;
        const bodyData  = buffer.slice(bodyStart, bodyEnd);
        const nameMatch     = headerStr.match(/name="([^"]+)"/);
        const filenameMatch = headerStr.match(/filename="([^"]+)"/);
        const ctMatch       = headerStr.match(/Content-Type:\s*(.+)/i);
        parts.push({
            name:     nameMatch     ? nameMatch[1]     : '',
            filename: filenameMatch ? filenameMatch[1] : '',
            mimetype: ctMatch       ? ctMatch[1].trim(): 'application/octet-stream',
            data:     bodyData,
        });
        start = bodyEnd + 2;
    }
    return parts;
}

function openBrowser(url) {
    const cmds = { darwin: `open "${url}"`, win32: `start "" "${url}"` };
    const cmd  = cmds[process.platform] || `xdg-open "${url}"`;
    exec(cmd, (err) => { if (err) console.log(`  Could not open browser. Visit: ${url}`); });
}

// ── Config ────────────────────────────────────────────────────────────────────

function loadConfig() {
    if (fs.existsSync(CONFIG_PATH)) {
        try { return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')); } catch (_) {}
    }
    return null;
}

function saveConfig(address, pubkey) {
    ensureDir(CONFIG_DIR);
    fs.writeFileSync(CONFIG_PATH, JSON.stringify({ address, pubkey, updated: new Date().toISOString() }, null, 2));
}

// ── Route handlers ────────────────────────────────────────────────────────────

function handleConfig(res) {
    const cfg = loadConfig();
    if (cfg && cfg.address && cfg.pubkey) {
        jsonResponse(res, 200, { configured: true, address: cfg.address.substring(0, 10) + '...', pubkey: cfg.pubkey.substring(0, 10) + '...' });
    } else {
        jsonResponse(res, 200, { configured: false });
    }
}

async function handleSetup(req, res) {
    try {
        const body   = JSON.parse((await readBody(req)).toString());
        const { address, pubkey } = body;

        if (!address || !pubkey) {
            return jsonResponse(res, 400, { error: 'address and pubkey are required' });
        }
        if (!address.match(/^0x[a-fA-F0-9]{64}$/)) {
            return jsonResponse(res, 400, { error: 'Invalid address — must start with 0x and be 66 characters' });
        }
        if (!pubkey.startsWith('Mx')) {
            return jsonResponse(res, 400, { error: 'Invalid public key — must start with Mx' });
        }

        saveConfig(address, pubkey);
        jsonResponse(res, 200, { ok: true });
    } catch (e) {
        jsonResponse(res, 500, { error: e.message });
    }
}

async function handleUploadImage(req, res) {
    try {
        ensureDir(TMP_IMG);
        const ct = req.headers['content-type'] || '';
        const boundaryMatch = ct.match(/boundary=(.+)/);
        if (!boundaryMatch) return jsonResponse(res, 400, { error: 'No multipart boundary' });

        const buffer = await readBody(req);
        const parts  = parseMultipart(buffer, boundaryMatch[1]);
        const file   = parts.find(p => p.filename);
        if (!file) return jsonResponse(res, 400, { error: 'No file found in upload' });

        const id   = crypto.randomBytes(8).toString('hex');
        const ext  = path.extname(file.filename) || '.jpg';
        const dest = path.join(TMP_IMG, id + ext);
        fs.writeFileSync(dest, file.data);

        jsonResponse(res, 200, { id: id + ext, path: dest, previewUrl: `/api/preview/${id + ext}` });
    } catch (e) {
        jsonResponse(res, 500, { error: e.message });
    }
}

function handlePreview(res, filename) {
    const filePath = path.join(TMP_IMG, path.basename(filename));
    if (!fs.existsSync(filePath)) { res.writeHead(404); res.end('Not found'); return; }
    serveFile(res, filePath);
}

async function handleBuild(req, res) {
    try {
        const body    = JSON.parse((await readBody(req)).toString());
        const { name, description, price, maxUnits, imagePath, currency } = body;

        if (!name) return jsonResponse(res, 400, { error: 'Product name is required' });
        if (!price || parseFloat(price) <= 0) return jsonResponse(res, 400, { error: 'Price must be greater than 0' });
        if (!maxUnits || parseInt(maxUnits) < 1) return jsonResponse(res, 400, { error: 'Max units must be at least 1' });
        if (currency && currency !== 'MINI' && currency !== 'USDT') return jsonResponse(res, 400, { error: 'Currency must be MINI or USDT' });

        const cfg = loadConfig();
        if (!cfg) return jsonResponse(res, 400, { error: 'Vendor not configured — go to Vendor Setup tab first' });

        ensureDir(DIST_DIR);

        const result  = await studioBuilder.build({
            name,
            description: description || '',
            price:       parseFloat(price),
            maxUnits:    parseInt(maxUnits),
            imagePath:   imagePath && fs.existsSync(imagePath) ? imagePath : null,
            address:     cfg.address,
            pubkey:      cfg.pubkey,
            currency:    currency || 'MINI',
        }, DIST_DIR);

        jsonResponse(res, 200, {
            ok:        true,
            shop:      result.shopFile,
            inbox:     result.inboxFile,
            shopSize:  result.shopSize,
            inboxSize: result.inboxSize,
            distDir:   DIST_DIR,
        });
    } catch (e) {
        console.error('Build error:', e);
        jsonResponse(res, 500, { error: e.message });
    }
}

function handleDownload(res, filename) {
    const filePath = path.join(DIST_DIR, path.basename(filename));
    if (!fs.existsSync(filePath)) { res.writeHead(404); res.end('File not found'); return; }
    const stat = fs.statSync(filePath);
    res.writeHead(200, {
        'Content-Type':        'application/zip',
        'Content-Disposition': `attachment; filename="${path.basename(filePath)}"`,
        'Content-Length':      stat.size,
    });
    fs.createReadStream(filePath).pipe(res);
}

// ── Server ────────────────────────────────────────────────────────────────────

let serverRef = null;

function createServer() {
    return http.createServer(async (req, res) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

        const url = req.url.split('?')[0];

        try {
            if (url === '/' || url === '/index.html') return serveFile(res, path.join(WEB_DIR, 'index.html'));
            if (url === '/style.css') return serveFile(res, path.join(WEB_DIR, 'style.css'));
            if (url === '/app.js')    return serveFile(res, path.join(WEB_DIR, 'app.js'));

            if (url === '/api/config' && req.method === 'GET')  return handleConfig(res);
            if (url === '/api/setup'  && req.method === 'POST') return await handleSetup(req, res);
            if (url === '/api/shutdown' && req.method === 'POST') {
                jsonResponse(res, 200, { ok: true });
                serverRef.close(() => process.exit(0));
                return;
            }
            if (url === '/api/upload-image' && req.method === 'POST') return await handleUploadImage(req, res);
            if (url === '/api/build'  && req.method === 'POST') return await handleBuild(req, res);

            if (url.startsWith('/api/preview/'))  return handlePreview(res, url.replace('/api/preview/', ''));
            if (url.startsWith('/api/download/')) return handleDownload(res, decodeURIComponent(url.replace('/api/download/', '')));

            res.writeHead(404); res.end('Not found');
        } catch (e) {
            console.error('Server error:', e);
            jsonResponse(res, 500, { error: 'Internal server error' });
        }
    });
}

function start() {
    ensureDir(TMP_IMG);
    ensureDir(DIST_DIR);

    serverRef    = createServer();
    const server = serverRef;
    const url    = `http://localhost:${PORT}`;

    server.listen(PORT, '127.0.0.1', () => {
        console.log(`
╔═══════════════════════════════════════════════════════════╗
║            🛍  miniFShop Studio                           ║
╠═══════════════════════════════════════════════════════════╣
║  Local server running at:                                  ║
║  ${url.padEnd(52)}║
║                                                            ║
║  Opening browser...                                        ║
║  Press Ctrl+C to stop                                      ║
╚═══════════════════════════════════════════════════════════╝
`);
        openBrowser(url);
    });

    server.on('error', (e) => {
        if (e.code === 'EADDRINUSE') {
            console.error(`\n❌ Port ${PORT} already in use. Is Studio already running?`);
            console.error(`   Try visiting: http://localhost:${PORT}\n`);
        } else {
            console.error('Server error:', e);
        }
        process.exit(1);
    });

    const shutdown = () => { console.log('\n\nStopping miniFShop Studio...'); server.close(() => process.exit(0)); };
    process.on('SIGINT',  shutdown);
    process.on('SIGTERM', shutdown);
}

module.exports = { start };

if (require.main === module || process.pkg) {
    try {
        start();
    } catch (e) {
        console.error('STARTUP ERROR:', e.message);
        console.error(e.stack);
        process.exitCode = 1;
    }
}
