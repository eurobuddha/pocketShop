'use strict';
// miniFShop Studio — frontend logic

let imagePath = ''; // server-side path of uploaded image

// ── Init ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    initTabs();
    loadConfigStatus();
    wireImageDrop();
    document.getElementById('build-btn').addEventListener('click', buildShop);
    document.getElementById('setup-form').addEventListener('submit', saveSetup);
});

// ── Tabs ──────────────────────────────────────────────────────────────────────
function initTabs() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-pane').forEach(p => { p.classList.add('hidden'); p.classList.remove('active'); });
            btn.classList.add('active');
            const pane = document.getElementById(`tab-${btn.dataset.tab}`);
            pane.classList.remove('hidden');
            pane.classList.add('active');
        });
    });
}

// ── Config status ─────────────────────────────────────────────────────────────
async function loadConfigStatus() {
    try {
        const res  = await fetch('/api/config');
        const data = await res.json();
        const el   = document.getElementById('config-status');
        if (data.configured) {
            el.className   = 'config-status ok';
            el.textContent = '✓ Vendor configured';
        } else {
            el.className = 'config-status warn';
            el.innerHTML = '⚠ Setup needed — <button class="tab-link" data-tab="setup">go to Vendor Setup</button>';
        }
    } catch (_) {}
}

// ── Setup form ────────────────────────────────────────────────────────────────
async function saveSetup(e) {
    e.preventDefault();
    const statusEl = document.getElementById('setup-status');
    statusEl.textContent = 'Saving…';
    statusEl.className   = 'setup-status';

    try {
        const res = await fetch('/api/setup', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({
                address: document.getElementById('setup-address').value.trim(),
                pubkey:  document.getElementById('setup-pubkey').value.trim(),
            }),
        });
        const data = await res.json();
        if (data.ok) {
            statusEl.textContent = '✓ Saved!';
            statusEl.className   = 'setup-status ok';
            loadConfigStatus();
        } else {
            statusEl.textContent = '✗ ' + (data.error || 'Failed');
            statusEl.className   = 'setup-status error';
        }
    } catch (err) {
        statusEl.textContent = '✗ ' + err.message;
        statusEl.className   = 'setup-status error';
    }
}

// ── Image drop zone ───────────────────────────────────────────────────────────
function wireImageDrop() {
    const zone    = document.getElementById('image-drop-zone');
    const input   = document.getElementById('f-image-input');
    const preview = document.getElementById('drop-preview');
    const pholder = document.getElementById('drop-placeholder');
    const warn    = document.getElementById('image-warn');

    zone.addEventListener('click', (e) => {
        if (e.target !== input) input.click();
    });

    input.addEventListener('change', () => {
        if (input.files[0]) handleImageFile(input.files[0], zone, preview, pholder, warn);
    });

    zone.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.dataTransfer.types.includes('Files')) zone.classList.add('drag-active');
    });

    zone.addEventListener('dragleave', (e) => {
        e.stopPropagation();
        zone.classList.remove('drag-active');
    });

    zone.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        zone.classList.remove('drag-active');
        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith('image/')) {
            handleImageFile(file, zone, preview, pholder, warn);
        }
    });
}

// ── Image resize ──────────────────────────────────────────────────────────────
const IMAGE_MAX_KB  = 10;   // target size for raster images
const IMAGE_MAX_DIM = 512;  // max width or height in pixels

// Returns { blob, resized, originalKB, finalKB, width, height }
function resizeImageIfNeeded(file) {
    return new Promise((resolve) => {
        // SVG is vector — skip canvas resize, just return as-is
        if (file.type === 'image/svg+xml') {
            resolve({ blob: file, resized: false, originalKB: file.size / 1024, finalKB: file.size / 1024 });
            return;
        }

        const originalKB = file.size / 1024;

        const img = new Image();
        const url = URL.createObjectURL(file);

        img.onload = () => {
            URL.revokeObjectURL(url);

            // Compute scaled dimensions (preserve aspect ratio)
            let w = img.naturalWidth;
            let h = img.naturalHeight;
            if (w > IMAGE_MAX_DIM || h > IMAGE_MAX_DIM) {
                if (w >= h) { h = Math.round(h * IMAGE_MAX_DIM / w); w = IMAGE_MAX_DIM; }
                else        { w = Math.round(w * IMAGE_MAX_DIM / h); h = IMAGE_MAX_DIM; }
            }

            const canvas = document.createElement('canvas');
            canvas.width  = w;
            canvas.height = h;
            canvas.getContext('2d').drawImage(img, 0, 0, w, h);

            const targetBytes = IMAGE_MAX_KB * 1024;

            // Already small enough at full quality at scaled size? Check first.
            canvas.toBlob((probe) => {
                if (probe.size <= targetBytes && originalKB <= IMAGE_MAX_KB) {
                    // No resize needed
                    resolve({ blob: file, resized: false, originalKB, finalKB: originalKB });
                    return;
                }

                // Iteratively reduce quality until under target
                let quality = 0.85;

                const tryNext = () => {
                    canvas.toBlob((blob) => {
                        if (blob.size <= targetBytes || quality <= 0.15) {
                            resolve({ blob, resized: true, originalKB, finalKB: blob.size / 1024, width: w, height: h });
                        } else {
                            quality = Math.round((quality - 0.1) * 100) / 100;
                            tryNext();
                        }
                    }, 'image/jpeg', quality);
                };

                tryNext();
            }, 'image/jpeg', 0.9);
        };

        img.onerror = () => {
            URL.revokeObjectURL(url);
            resolve({ blob: file, resized: false, originalKB, finalKB: originalKB });
        };

        img.src = url;
    });
}

async function handleImageFile(file, zone, preview, pholder, warn) {
    // Show local preview immediately before any resizing
    const reader = new FileReader();
    reader.onload = (e) => {
        preview.src = e.target.result;
        preview.classList.remove('hidden');
        pholder.classList.add('hidden');
    };
    reader.readAsDataURL(file);

    warn.classList.add('hidden');
    warn.className = 'upload-warn hidden';

    // Resize if needed, then upload
    try {
        const result = await resizeImageIfNeeded(file);

        // Update preview with resized version if changed
        if (result.resized) {
            const resizedUrl = URL.createObjectURL(result.blob);
            preview.src = resizedUrl;
            warn.textContent = `✓ Resized: ${result.originalKB.toFixed(1)} KB → ${result.finalKB.toFixed(1)} KB` +
                               (result.width ? ` (${result.width}×${result.height}px)` : '');
            warn.className = 'upload-info';
            warn.classList.remove('hidden');
        }

        const ext      = result.resized ? '.jpg' : (file.name.match(/\.[^.]+$/) || ['.jpg'])[0];
        const filename = 'product' + ext;
        const formData = new FormData();
        formData.append('image', result.blob, filename);

        const res  = await fetch('/api/upload-image', { method: 'POST', body: formData });
        const data = await res.json();

        if (data.path) {
            imagePath = data.path;
        } else {
            warn.textContent = '⚠ Preview only — could not save to server. Default image will be used.';
            warn.className = 'upload-warn';
            warn.classList.remove('hidden');
        }
    } catch (_) {
        warn.textContent = '⚠ Preview only — default image will be used in build.';
        warn.className = 'upload-warn';
        warn.classList.remove('hidden');
    }
}

// ── Build ─────────────────────────────────────────────────────────────────────
async function buildShop() {
    const buildBtn     = document.getElementById('build-btn');
    const buildBtnText = document.getElementById('build-btn-text');
    const buildSpinner = document.getElementById('build-spinner');
    const statusEl     = document.getElementById('build-status');
    const resultPanel  = document.getElementById('result-panel');

    const name     = document.getElementById('f-name').value.trim();
    const desc     = document.getElementById('f-desc').value.trim();
    const price    = parseFloat(document.getElementById('f-price').value);
    const maxUnits = parseInt(document.getElementById('f-max-units').value);

    // Validate
    if (!name) {
        document.getElementById('f-name').focus();
        return showStatus(statusEl, 'error', 'Product name is required.');
    }
    if (!price || price <= 0) {
        document.getElementById('f-price').focus();
        return showStatus(statusEl, 'error', 'Price must be greater than 0.');
    }
    if (!maxUnits || maxUnits < 1) {
        document.getElementById('f-max-units').focus();
        return showStatus(statusEl, 'error', 'Max units must be at least 1.');
    }

    // Start build
    buildBtn.disabled        = true;
    buildBtnText.textContent = 'Building…';
    buildSpinner.classList.remove('hidden');
    resultPanel.classList.add('hidden');
    showStatus(statusEl, 'pending', 'Generating MiniDapp files…');

    try {
        const res  = await fetch('/api/build', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ name, description: desc, price, maxUnits, imagePath }),
        });
        const data = await res.json();

        if (!res.ok || !data.ok) throw new Error(data.error || 'Build failed');

        showStatus(statusEl, 'success', '✓ Build complete — files saved to dist/');
        showResult(data);
    } catch (err) {
        showStatus(statusEl, 'error', '✗ ' + err.message);
    } finally {
        buildBtn.disabled        = false;
        buildBtnText.textContent = 'Build Shop';
        buildSpinner.classList.add('hidden');
    }
}

function showStatus(el, type, msg) {
    el.textContent = msg;
    el.className   = `build-status ${type}`;
    el.classList.remove('hidden');
}

function showResult(data) {
    const panel   = document.getElementById('result-panel');
    const shopName = document.getElementById('shop-filename');
    const shopBtn  = document.getElementById('shop-download-btn');
    const inboxBtn = document.getElementById('inbox-download-btn');

    shopName.textContent = data.shop + (data.shopSize ? `  (${(data.shopSize / 1024).toFixed(1)} KB)` : '');
    shopBtn.href  = `/api/download/${encodeURIComponent(data.shop)}`;
    inboxBtn.href = `/api/download/${encodeURIComponent(data.inbox)}`;

    if (data.distDir) {
        document.getElementById('result-note').innerHTML = `Files saved to <code>${data.distDir}</code>`;
    }

    // Warn if shop is over 50KB
    if (data.shopSize && data.shopSize > 50 * 1024) {
        const warn = document.createElement('p');
        warn.style.cssText = 'margin-top:0.5rem;font-size:0.8rem;color:#e09020;';
        warn.textContent = `⚠ shop.mds.zip is ${(data.shopSize / 1024).toFixed(1)} KB — exceeds the 50 KB MiniFS limit. Use a smaller image.`;
        panel.appendChild(warn);
    }

    panel.classList.remove('hidden');
    panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// ── Tab-link delegation ───────────────────────────────────────────────────────
document.addEventListener('click', (e) => {
    const target = e.target.closest('.tab-link');
    if (target) {
        e.preventDefault();
        document.querySelector(`[data-tab="${target.dataset.tab}"]`)?.click();
    }
});
