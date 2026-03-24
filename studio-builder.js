'use strict';

// studio-builder.js
// Generates shop.mds.zip + mInbox.zip from miniFShop templates.
// Called by studio.js after form submission.

const fs      = require('fs');
const path    = require('path');
const archiver = require('archiver');

const SHOP_TEMPLATE_DIR  = path.join(__dirname, 'miniFShop-shop');
const INBOX_TEMPLATE_DIR = path.join(__dirname, 'mInbox');
const DEFAULT_IMAGE      = path.join(SHOP_TEMPLATE_DIR, 'product.svg');

const USDT_TOKEN_ID = '0x7D39745FBD29049BE29850B55A18BF550E4D442F930F86266E34193D89042A90';
const MINI_TOKEN_ID = '0x00';

function getCurrencyConfig(currency) {
    if (currency === 'USDT') {
        return { label: 'USDT', tokenId: USDT_TOKEN_ID, icon: 'usdt_icon.svg' };
    }
    return { label: 'MINI', tokenId: MINI_TOKEN_ID, icon: 'minima_logo_bw.svg' };
}

function ensureDir(d) { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); }
function copyFile(s, d) { if (fs.existsSync(s)) fs.copyFileSync(s, d); }

function zipDir(tmpDir, outPath) {
    return new Promise((resolve, reject) => {
        const output  = fs.createWriteStream(outPath);
        const archive = archiver('zip', { zlib: { level: 9 } });
        output.on('close', () => resolve(archive.pointer()));
        archive.on('error', reject);
        archive.pipe(output);
        archive.directory(tmpDir, false);
        archive.finalize();
    });
}

function generateShopConfig(address, pubkey, name) {
    return `// Shop - Vendor Configuration
const VENDOR_PUBLIC_KEY = "${pubkey}";
const VENDOR_ADDRESS = "${address}";

const VENDOR_CONFIG = {
    vendorPublicKey: VENDOR_PUBLIC_KEY,
    vendorAddress: VENDOR_ADDRESS,
    appName: ${JSON.stringify(name)},
    version: "1.0.0"
};
`;
}

function generateInboxConfig(address, pubkey) {
    return `// mInbox - Vendor Configuration
const SHOP_ADDRESS = "0x5452454553484F50";
const VENDOR_ADDRESS = "${address}";
const VENDOR_PUBLIC_KEY = "${pubkey}";

const VENDOR_CONFIG = {
    vendorPublicKey: VENDOR_PUBLIC_KEY,
    vendorAddress: VENDOR_ADDRESS,
    appName: "mInbox",
    version: "1.0.0"
};
`;
}

function generateShopDappConf(name, description, currency) {
    const currLabel = currency === 'USDT' ? 'USDT' : 'Minima';
    return JSON.stringify({
        name:        name.replace(/[^a-zA-Z0-9 \-]/g, '').trim() || 'miniFShop',
        icon:        'icon.svg',
        version:     '1.0.0',
        description: description || `Buy ${name} with ${currLabel}`,
        category:    'Commerce',
    }, null, '\t');
}

function generateShopHtml(template, { name, description, price, maxUnits, imageFile, currencyLabel, tokenId, currencyIcon }) {
    return template
        .replace(/\{\{PRODUCT_NAME\}\}/g, name)
        .replace(/\{\{PRODUCT_DESCRIPTION\}\}/g, description)
        .replace(/\{\{PRODUCT_PRICE\}\}/g, price)
        .replace(/\{\{MAX_UNITS\}\}/g, maxUnits)
        .replace(/\{\{PRODUCT_IMAGE\}\}/g, imageFile)
        .replace(/\{\{CURRENCY_LABEL\}\}/g, currencyLabel)
        .replace(/\{\{TOKEN_ID\}\}/g, tokenId)
        .replace(/\{\{CURRENCY_ICON\}\}/g, currencyIcon);
}

async function build({ name, description, price, maxUnits, imagePath, address, pubkey, currency }, distDir) {
    ensureDir(distDir);
    const currConfig = getCurrencyConfig(currency);

    // ── Shop ─────────────────────────────────────────────────────────────────
    const shopTmp = path.join(distDir, `_tmp_shop_${Date.now()}`);
    ensureDir(shopTmp);

    // Determine image filename
    const imageExt  = imagePath ? path.extname(imagePath) : '.svg';
    const imageFile = 'product' + imageExt;

    // Copy template files (skip files we'll generate)
    const skipFiles = new Set(['config.js', 'index.html', 'dapp.conf', 'products.js', 'tree.svg']);
    for (const file of fs.readdirSync(SHOP_TEMPLATE_DIR)) {
        if (skipFiles.has(file)) continue;
        if (file === 'product.svg' && imagePath) continue; // will copy custom image
        if (file.startsWith('.')) continue;
        copyFile(path.join(SHOP_TEMPLATE_DIR, file), path.join(shopTmp, file));
    }

    // Generate config.js
    fs.writeFileSync(path.join(shopTmp, 'config.js'), generateShopConfig(address, pubkey, name));

    // Generate index.html from template
    const templatePath = path.join(SHOP_TEMPLATE_DIR, 'index.template.html');
    if (!fs.existsSync(templatePath)) throw new Error('index.template.html not found in miniFShop-shop/');
    const template = fs.readFileSync(templatePath, 'utf8');
    const html     = generateShopHtml(template, { name, description, price, maxUnits, imageFile,
        currencyLabel: currConfig.label, tokenId: currConfig.tokenId, currencyIcon: currConfig.icon });
    fs.writeFileSync(path.join(shopTmp, 'index.html'), html);

    // Generate dapp.conf
    fs.writeFileSync(path.join(shopTmp, 'dapp.conf'), generateShopDappConf(name, description, currency));

    // Handle product image
    if (imagePath && fs.existsSync(imagePath)) {
        fs.copyFileSync(imagePath, path.join(shopTmp, imageFile));
    } else {
        // Use default product.svg
        copyFile(DEFAULT_IMAGE, path.join(shopTmp, 'product.svg'));
    }

    const shopFile    = 'shop.mds.zip';
    const shopZipPath = path.join(distDir, shopFile);
    const shopSize    = await zipDir(shopTmp, shopZipPath);
    fs.rmSync(shopTmp, { recursive: true, force: true });

    // Warn if over 50KB
    if (shopSize > 50 * 1024) {
        console.warn(`⚠  shop.mds.zip is ${(shopSize / 1024).toFixed(1)}KB — exceeds 50KB MiniFS limit`);
    }

    // ── mInbox ────────────────────────────────────────────────────────────────
    const inboxTmp = path.join(distDir, `_tmp_inbox_${Date.now()}`);
    ensureDir(inboxTmp);

    const skipInbox = new Set(['config.js']);
    for (const file of fs.readdirSync(INBOX_TEMPLATE_DIR)) {
        if (skipInbox.has(file)) continue;
        if (file.startsWith('.')) continue;
        copyFile(path.join(INBOX_TEMPLATE_DIR, file), path.join(inboxTmp, file));
    }

    fs.writeFileSync(path.join(inboxTmp, 'config.js'), generateInboxConfig(address, pubkey));

    const inboxFile    = 'mInbox.zip';
    const inboxZipPath = path.join(distDir, inboxFile);
    const inboxSize    = await zipDir(inboxTmp, inboxZipPath);
    fs.rmSync(inboxTmp, { recursive: true, force: true });

    return { shopFile, inboxFile, shopSize, inboxSize };
}

module.exports = { build };
