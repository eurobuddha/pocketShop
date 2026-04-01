'use strict';
// Pocket Shop Studio v2 — multi-product frontend logic

const MAX_PRODUCTS   = 4;
const IMAGE_MAX_KB   = 10;
const IMAGE_MAX_DIM  = 512;

let selectedCurrency = 'MINI';
let products = []; // [{name, desc, price, maxUnits, imagePath}]

// ── Init ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    initTabs();
    loadConfigStatus();
    wireCurrencyPicker();
    addProductBlock(); // start with 1 product
    document.getElementById('add-product-btn').addEventListener('click', () => addProductBlock());
    document.getElementById('build-btn').addEventListener('click', buildShop);
    document.getElementById('setup-form').addEventListener('submit', saveSetup);
    document.getElementById('stop-btn').addEventListener('click', stopServer);
});

// ── Product Blocks ───────────────────────────────────────────────────────────
function addProductBlock() {
    if (products.length >= MAX_PRODUCTS) return;
    const idx = products.length;
    products.push({ name: '', desc: '', price: '', maxUnits: 10, imagePath: '' });

    const container = document.getElementById('products-container');
    const block = document.createElement('div');
    block.className = 'product-card product-block';
    block.id = 'product-block-' + idx;
    block.innerHTML = `
        <div class="product-block-header">
            <span class="product-block-label">Product ${idx + 1}</span>
            ${idx > 0 ? '<button type="button" class="btn-remove-product" data-idx="' + idx + '">&times; Remove</button>' : ''}
        </div>
        <div class="card-body">
            <div class="card-fields">
                <div class="field-row">
                    <div class="field-group field-group--grow">
                        <label>Name <span class="required">*</span></label>
                        <input type="text" class="pf-name" data-idx="${idx}" placeholder="e.g. Organic Honey" maxlength="120">
                    </div>
                </div>
                <div class="field-row">
                    <div class="field-group field-group--grow">
                        <label>Description</label>
                        <textarea class="pf-desc" data-idx="${idx}" rows="2" placeholder="Short description (optional)" maxlength="300"></textarea>
                    </div>
                </div>
                <div class="field-row">
                    <div class="field-group">
                        <label>Price <span class="required">*</span></label>
                        <input type="number" class="pf-price" data-idx="${idx}" min="0.000001" step="0.000001" placeholder="1">
                    </div>
                    <div class="field-group">
                        <label>Max units</label>
                        <input type="number" class="pf-max" data-idx="${idx}" min="1" step="1" placeholder="10" value="10">
                    </div>
                </div>
            </div>
            <div class="card-image-col">
                <label>Image</label>
                <div class="image-drop-zone" id="image-zone-${idx}">
                    <input type="file" class="pf-image-input" data-idx="${idx}" accept="image/*" tabindex="-1">
                    <div class="drop-placeholder" id="drop-ph-${idx}">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="32" height="32">
                            <rect x="3" y="3" width="18" height="18" rx="2"/>
                            <circle cx="8.5" cy="8.5" r="1.5"/>
                            <polyline points="21 15 16 10 5 21"/>
                        </svg>
                        <p>Drop image<br>or <span class="browse-link">browse</span></p>
                    </div>
                    <img id="drop-preview-${idx}" class="drop-preview hidden" alt="Preview">
                </div>
                <p id="image-warn-${idx}" class="upload-warn hidden"></p>
            </div>
        </div>
    `;
    container.appendChild(block);
    wireProductBlockEvents(block, idx);
    updateCounter();
}

function removeProductBlock(idx) {
    if (products.length <= 1) return;
    products.splice(idx, 1);
    rebuildProductBlocks();
}

function rebuildProductBlocks() {
    const saved = products.map((p, i) => ({
        name: document.querySelector(`.pf-name[data-idx="${i}"]`)?.value || p.name,
        desc: document.querySelector(`.pf-desc[data-idx="${i}"]`)?.value || p.desc,
        price: document.querySelector(`.pf-price[data-idx="${i}"]`)?.value || p.price,
        maxUnits: document.querySelector(`.pf-max[data-idx="${i}"]`)?.value || p.maxUnits,
        imagePath: p.imagePath
    }));
    products = [];
    document.getElementById('products-container').innerHTML = '';
    saved.forEach(p => {
        addProductBlock();
        const idx = products.length - 1;
        document.querySelector(`.pf-name[data-idx="${idx}"]`).value = p.name;
        document.querySelector(`.pf-desc[data-idx="${idx}"]`).value = p.desc;
        document.querySelector(`.pf-price[data-idx="${idx}"]`).value = p.price;
        document.querySelector(`.pf-max[data-idx="${idx}"]`).value = p.maxUnits;
        products[idx].imagePath = p.imagePath;
    });
}

function updateCounter() {
    const counter = document.getElementById('product-counter');
    counter.textContent = `(${products.length}/${MAX_PRODUCTS})`;
    document.getElementById('add-product-btn').disabled = products.length >= MAX_PRODUCTS;
}

function wireProductBlockEvents(block, idx) {
    // Remove button
    const removeBtn = block.querySelector('.btn-remove-product');
    if (removeBtn) removeBtn.addEventListener('click', () => removeProductBlock(idx));

    // Image drop zone
    const zone    = block.querySelector('.image-drop-zone');
    const input   = block.querySelector('.pf-image-input');
    const preview = block.querySelector('.drop-preview');
    const pholder = block.querySelector('.drop-placeholder');
    const warn    = document.getElementById('image-warn-' + idx);

    zone.addEventListener('click', (e) => { if (e.target !== input) input.click(); });
    input.addEventListener('change', () => {
        if (input.files[0]) handleImageFile(input.files[0], idx, zone, preview, pholder, warn);
    });
    zone.addEventListener('dragover', (e) => { e.preventDefault(); e.stopPropagation(); zone.classList.add('drag-active'); });
    zone.addEventListener('dragleave', (e) => { e.stopPropagation(); zone.classList.remove('drag-active'); });
    zone.addEventListener('drop', (e) => {
        e.preventDefault(); e.stopPropagation(); zone.classList.remove('drag-active');
        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith('image/')) handleImageFile(file, idx, zone, preview, pholder, warn);
    });
}

// ── Image handling ───────────────────────────────────────────────────────────
function resizeImageIfNeeded(file) {
    return new Promise((resolve) => {
        if (file.type === 'image/svg+xml') {
            resolve({ blob: file, resized: false, originalKB: file.size / 1024, finalKB: file.size / 1024 });
            return;
        }
        const originalKB = file.size / 1024;
        const img = new Image();
        const url = URL.createObjectURL(file);
        img.onload = () => {
            URL.revokeObjectURL(url);
            let w = img.naturalWidth, h = img.naturalHeight;
            if (w > IMAGE_MAX_DIM || h > IMAGE_MAX_DIM) {
                if (w >= h) { h = Math.round(h * IMAGE_MAX_DIM / w); w = IMAGE_MAX_DIM; }
                else { w = Math.round(w * IMAGE_MAX_DIM / h); h = IMAGE_MAX_DIM; }
            }
            const canvas = document.createElement('canvas');
            canvas.width = w; canvas.height = h;
            canvas.getContext('2d').drawImage(img, 0, 0, w, h);
            const targetBytes = IMAGE_MAX_KB * 1024;
            canvas.toBlob((probe) => {
                if (probe.size <= targetBytes && originalKB <= IMAGE_MAX_KB) {
                    resolve({ blob: file, resized: false, originalKB, finalKB: originalKB });
                    return;
                }
                let quality = 0.85;
                const tryNext = () => {
                    canvas.toBlob((blob) => {
                        if (blob.size <= targetBytes || quality <= 0.15) {
                            resolve({ blob, resized: true, originalKB, finalKB: blob.size / 1024, width: w, height: h });
                        } else { quality = Math.round((quality - 0.1) * 100) / 100; tryNext(); }
                    }, 'image/jpeg', quality);
                };
                tryNext();
            }, 'image/jpeg', 0.9);
        };
        img.onerror = () => { URL.revokeObjectURL(url); resolve({ blob: file, resized: false, originalKB, finalKB: originalKB }); };
        img.src = url;
    });
}

async function handleImageFile(file, idx, zone, preview, pholder, warn) {
    const reader = new FileReader();
    reader.onload = (e) => { preview.src = e.target.result; preview.classList.remove('hidden'); pholder.classList.add('hidden'); };
    reader.readAsDataURL(file);
    warn.classList.add('hidden');

    try {
        const result = await resizeImageIfNeeded(file);
        if (result.resized) {
            preview.src = URL.createObjectURL(result.blob);
            warn.textContent = `Resized: ${result.originalKB.toFixed(1)} KB -> ${result.finalKB.toFixed(1)} KB`;
            warn.className = 'upload-info'; warn.classList.remove('hidden');
        }
        const ext = result.resized ? '.jpg' : (file.name.match(/\.[^.]+$/) || ['.jpg'])[0];
        const formData = new FormData();
        formData.append('image', result.blob, 'product-' + idx + ext);
        const res = await fetch('/api/upload-image', { method: 'POST', body: formData });
        const data = await res.json();
        if (data.path) { products[idx].imagePath = data.path; }
        else { warn.textContent = 'Preview only — default image will be used.'; warn.className = 'upload-warn'; warn.classList.remove('hidden'); }
    } catch (_) {
        warn.textContent = 'Preview only — default image will be used.'; warn.className = 'upload-warn'; warn.classList.remove('hidden');
    }
}

// ── Tabs ─────────────────────────────────────────────────────────────────────
function initTabs() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-pane').forEach(p => { p.classList.add('hidden'); p.classList.remove('active'); });
            btn.classList.add('active');
            const pane = document.getElementById(`tab-${btn.dataset.tab}`);
            pane.classList.remove('hidden'); pane.classList.add('active');
        });
    });
}

// ── Config status ────────────────────────────────────────────────────────────
async function loadConfigStatus() {
    try {
        const res = await fetch('/api/config');
        const data = await res.json();
        const el = document.getElementById('config-status');
        if (data.configured) { el.className = 'config-status ok'; el.textContent = 'Vendor configured'; }
        else { el.className = 'config-status warn'; el.innerHTML = 'Setup needed — <button class="tab-link" data-tab="setup">go to Vendor Setup</button>'; }
    } catch (_) {}
}

// ── Setup form ───────────────────────────────────────────────────────────────
async function saveSetup(e) {
    e.preventDefault();
    const statusEl = document.getElementById('setup-status');
    statusEl.textContent = 'Saving...'; statusEl.className = 'setup-status';
    try {
        const res = await fetch('/api/setup', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ address: document.getElementById('setup-address').value.trim(), pubkey: document.getElementById('setup-pubkey').value.trim() })
        });
        const data = await res.json();
        if (data.ok) { statusEl.textContent = 'Saved!'; statusEl.className = 'setup-status ok'; loadConfigStatus(); }
        else { statusEl.textContent = 'Error: ' + (data.error || 'Failed'); statusEl.className = 'setup-status error'; }
    } catch (err) { statusEl.textContent = 'Error: ' + err.message; statusEl.className = 'setup-status error'; }
}

// ── Currency picker ──────────────────────────────────────────────────────────
function wireCurrencyPicker() {
    document.querySelectorAll('.currency-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.currency-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            selectedCurrency = btn.dataset.currency;
        });
    });
}

// ── Build ────────────────────────────────────────────────────────────────────
async function buildShop() {
    const buildBtn     = document.getElementById('build-btn');
    const buildBtnText = document.getElementById('build-btn-text');
    const buildSpinner = document.getElementById('build-spinner');
    const statusEl     = document.getElementById('build-status');
    const resultPanel  = document.getElementById('result-panel');

    const shopName = document.getElementById('f-shop-name').value.trim();
    if (!shopName) { document.getElementById('f-shop-name').focus(); return showBuildStatus(statusEl, 'error', 'Shop name is required.'); }

    // Collect products from form
    const productData = [];
    for (let i = 0; i < products.length; i++) {
        const name = document.querySelector(`.pf-name[data-idx="${i}"]`).value.trim();
        const desc = document.querySelector(`.pf-desc[data-idx="${i}"]`).value.trim();
        const price = parseFloat(document.querySelector(`.pf-price[data-idx="${i}"]`).value);
        const maxUnits = parseInt(document.querySelector(`.pf-max[data-idx="${i}"]`).value) || 10;

        if (!name) { document.querySelector(`.pf-name[data-idx="${i}"]`).focus(); return showBuildStatus(statusEl, 'error', `Product ${i + 1}: name is required.`); }
        if (!price || price <= 0) { document.querySelector(`.pf-price[data-idx="${i}"]`).focus(); return showBuildStatus(statusEl, 'error', `Product ${i + 1}: price must be > 0.`); }

        productData.push({ name, description: desc, price, maxUnits, imagePath: products[i].imagePath });
    }

    buildBtn.disabled = true;
    buildBtnText.textContent = 'Building...';
    buildSpinner.classList.remove('hidden');
    resultPanel.classList.add('hidden');
    showBuildStatus(statusEl, 'pending', 'Generating MiniDapp files...');

    try {
        const res = await fetch('/api/build', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ shopName, products: productData, currency: selectedCurrency })
        });
        const data = await res.json();
        if (!res.ok || !data.ok) throw new Error(data.error || 'Build failed');
        showBuildStatus(statusEl, 'success', 'Build complete — files saved to dist/');
        showResult(data);
    } catch (err) {
        showBuildStatus(statusEl, 'error', err.message);
    } finally {
        buildBtn.disabled = false;
        buildBtnText.textContent = 'Build Shop';
        buildSpinner.classList.add('hidden');
    }
}

function showBuildStatus(el, type, msg) {
    el.textContent = msg;
    el.className = `build-status ${type}`;
    el.classList.remove('hidden');
}

function showResult(data) {
    const panel = document.getElementById('result-panel');
    document.getElementById('shop-filename').textContent = data.shop + (data.shopSize ? `  (${(data.shopSize / 1024).toFixed(1)} KB)` : '');
    document.getElementById('shop-download-btn').href = `/api/download/${encodeURIComponent(data.shop)}`;
    document.getElementById('inbox-download-btn').href = `/api/download/${encodeURIComponent(data.inbox)}`;
    if (data.distDir) document.getElementById('result-note').innerHTML = `Files saved to <code>${data.distDir}</code>`;

    if (data.shopSize && data.shopSize > 50 * 1024) {
        const warn = document.createElement('p');
        warn.style.cssText = 'margin-top:0.5rem;font-size:0.8rem;color:#e09020;';
        warn.textContent = `Warning: ${(data.shopSize / 1024).toFixed(1)} KB exceeds 50 KB MiniFS limit. Use smaller images.`;
        panel.appendChild(warn);
    }
    panel.classList.remove('hidden');
    panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// ── Stop server ──────────────────────────────────────────────────────────────
async function stopServer() {
    if (!confirm('Stop the Pocket Shop Studio server?')) return;
    try { await fetch('/api/shutdown', { method: 'POST' }); } catch (_) {}
    document.body.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;flex-direction:column;gap:1rem;color:#555"><div style="font-size:2rem">Server stopped</div><p style="margin:0;font-size:0.9rem">You can close this tab.</p></div>';
}

// ── Tab-link delegation ──────────────────────────────────────────────────────
document.addEventListener('click', (e) => {
    const target = e.target.closest('.tab-link');
    if (target) { e.preventDefault(); document.querySelector(`[data-tab="${target.dataset.tab}"]`)?.click(); }
});
