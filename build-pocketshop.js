#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const TEMPLATE_DIR = path.join(__dirname);
const OUT_DIR = path.join(__dirname, 'dist');

function ensureDir(dir) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

function parseArgs(args) {
    const result = {
        address: null,
        pubkey: null,
        name: 'Product',
        description: 'A great product available for purchase with Minima.',
        price: '1',
        maxUnits: '10',
        image: null
    };
    
    // First two positional args are address and pubkey
    let positionalIndex = 0;
    
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        
        if (arg.startsWith('--')) {
            switch (arg) {
                case '--name':
                    result.name = args[++i];
                    break;
                case '--description':
                    result.description = args[++i];
                    break;
                case '--price':
                    result.price = args[++i];
                    break;
                case '--max-units':
                    result.maxUnits = args[++i];
                    break;
                case '--image':
                    result.image = args[++i];
                    break;
                default:
                    console.error(`Unknown option: ${arg}`);
                    process.exit(1);
            }
        } else {
            // Positional argument
            if (positionalIndex === 0) {
                result.address = arg;
            } else if (positionalIndex === 1) {
                result.pubkey = arg;
            }
            positionalIndex++;
        }
    }
    
    return result;
}

function showHelp() {
    console.log(`
╔═══════════════════════════════════════════════════════════╗
║          Pocket Shop Builder                                 ║
╠═══════════════════════════════════════════════════════════╣
║  Generates a shop + mInbox with your config               ║
╚═══════════════════════════════════════════════════════════╝

Usage:
  node build-pocketshop.js <address> <pubkey> [options]

Required:
  address               Your Minima wallet address (0x...)
  pubkey                Your MX public key (Mx...)

Options:
  --name <name>         Product name (default: "Product")
  --description <desc>  Product description
  --price <price>       Price per unit in MINI (default: 1)
  --max-units <max>     Maximum units per order (default: 10)
  --image <path>        Path to product image (SVG recommended, PNG/JPG ok if <10KB)

Examples:
  # Basic usage with defaults
  node build-pocketshop.js 0xA65ED661... MxG18HGG...

  # Custom product
  node build-pocketshop.js 0xA65ED661... MxG18HGG... --name "Honey" --price 2.5 --max-units 5

  # With custom image
  node build-pocketshop.js 0xA65ED661... MxG18HGG... --name "Art" --price 10 --image ./art.svg --description "Digital artwork"
`);
}

function handleImage(imagePath, shopDir) {
    if (!imagePath) {
        // Check if default product.svg exists, otherwise use icon.svg
        const defaultImage = path.join(shopDir, 'product.svg');
        if (fs.existsSync(defaultImage)) {
            return { filename: 'product.svg', warning: null };
        }
        // Create a simple placeholder SVG
        const placeholderSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
  <rect width="100" height="100" fill="#f0f0f0" rx="8"/>
  <text x="50" y="55" text-anchor="middle" font-family="sans-serif" font-size="14" fill="#999">Product</text>
</svg>`;
        fs.writeFileSync(path.join(shopDir, 'product.svg'), placeholderSvg);
        return { filename: 'product.svg', warning: null };
    }
    
    // Check if file exists
    if (!fs.existsSync(imagePath)) {
        console.error(`Error: Image file not found: ${imagePath}`);
        process.exit(1);
    }
    
    const stats = fs.statSync(imagePath);
    const sizeKB = stats.size / 1024;
    let warning = null;
    
    if (sizeKB > 10) {
        warning = `Warning: Image is ${sizeKB.toFixed(1)}KB. Consider using SVG or optimizing to keep total package under 50KB.`;
    }
    
    const ext = path.extname(imagePath).toLowerCase();
    const validExts = ['.svg', '.png', '.jpg', '.jpeg', '.gif', '.webp'];
    if (!validExts.includes(ext)) {
        console.error(`Error: Unsupported image format: ${ext}. Use SVG, PNG, JPG, GIF, or WebP.`);
        process.exit(1);
    }
    
    const destFilename = 'product' + ext;
    fs.copyFileSync(imagePath, path.join(shopDir, destFilename));
    
    return { filename: destFilename, warning };
}

function generateShopHtml(config, imageFilename) {
    const templatePath = path.join(TEMPLATE_DIR, 'pocketshop-shop', 'index.template.html');
    
    if (!fs.existsSync(templatePath)) {
        console.error('Error: Template file not found:', templatePath);
        process.exit(1);
    }
    
    let html = fs.readFileSync(templatePath, 'utf8');
    
    // Replace all placeholders
    html = html.replace(/\{\{PRODUCT_NAME\}\}/g, config.name)
               .replace(/\{\{PRODUCT_DESCRIPTION\}\}/g, config.description)
               .replace(/\{\{PRODUCT_PRICE\}\}/g, config.price)
               .replace(/\{\{MAX_UNITS\}\}/g, config.maxUnits)
               .replace(/\{\{PRODUCT_IMAGE\}\}/g, imageFilename);
    
    return html;
}

function build(args) {
    const config = parseArgs(args);
    
    // Validate required args
    if (!config.address || !config.pubkey) {
        showHelp();
        process.exit(1);
    }
    
    if (!config.address.startsWith('0x')) {
        console.error('Error: Minima address must start with 0x');
        process.exit(1);
    }
    if (!config.pubkey.startsWith('Mx')) {
        console.error('Error: Public key must start with Mx');
        process.exit(1);
    }

    console.log(`
╔═══════════════════════════════════════════════════════════╗
║          Pocket Shop Builder                                 ║
╚═══════════════════════════════════════════════════════════╝
📦 Address:     ${config.address.substring(0, 18)}...
🔐 PubKey:      ${config.pubkey.substring(0, 18)}...
🏷️  Product:     ${config.name}
💰 Price:       ${config.price} MINI
📊 Max Units:   ${config.maxUnits}
`);

    ensureDir(OUT_DIR);
    
    const shopDir = path.join(TEMPLATE_DIR, 'pocketshop-shop');

    // Handle image
    const imageResult = handleImage(config.image, shopDir);
    if (imageResult.warning) {
        console.log(`⚠️  ${imageResult.warning}`);
    }

    // Generate shop config.js
    const shopConfig = `// Shop - Vendor Configuration
const VENDOR_PUBLIC_KEY = "${config.pubkey}";
const VENDOR_ADDRESS = "${config.address}";

const VENDOR_CONFIG = {
    vendorPublicKey: VENDOR_PUBLIC_KEY,
    vendorAddress: VENDOR_ADDRESS,
    appName: "${config.name}",
    version: "1.0.0"
};
`;
    fs.writeFileSync(path.join(shopDir, 'config.js'), shopConfig);
    console.log('✓ Generated shop config.js');

    // Generate shop index.html from template
    const shopHtml = generateShopHtml(config, imageResult.filename);
    fs.writeFileSync(path.join(shopDir, 'index.html'), shopHtml);
    console.log('✓ Generated shop index.html');

    // Generate and write inbox config
    const inboxConfig = `// mInbox - Vendor Configuration
const SHOP_ADDRESS = "0x5452454553484F50";
const VENDOR_ADDRESS = "${config.address}";
const VENDOR_PUBLIC_KEY = "${config.pubkey}";

const VENDOR_CONFIG = {
    vendorPublicKey: VENDOR_PUBLIC_KEY,
    vendorAddress: VENDOR_ADDRESS,
    appName: "mInbox",
    version: "1.0.0"
};
`;
    fs.writeFileSync(path.join(TEMPLATE_DIR, 'mInbox', 'config.js'), inboxConfig);
    console.log('✓ Generated mInbox config.js');

    // Create shop zip (exclude template file, products.js, and old tree.svg)
    console.log('📦 Creating shop.mds.zip...');
    const shopZipPath = path.join(OUT_DIR, 'shop.mds.zip');
    if (fs.existsSync(shopZipPath)) fs.unlinkSync(shopZipPath);
    
    const excludeFiles = ['index.template.html', 'products.js', 'tree.svg'];
    const shopFiles = fs.readdirSync(shopDir)
        .filter(f => !f.startsWith('.') && !excludeFiles.includes(f))
        .join(' ');
    execSync(`cd "${shopDir}" && zip -rq "${shopZipPath}" ${shopFiles}`, { stdio: 'pipe' });

    // Create mInbox.zip
    console.log('📦 Creating mInbox.zip...');
    const inboxZipPath = path.join(OUT_DIR, 'mInbox.zip');
    if (fs.existsSync(inboxZipPath)) fs.unlinkSync(inboxZipPath);
    execSync(`cd "${path.join(TEMPLATE_DIR, 'mInbox')}" && zip -rq "${inboxZipPath}" *`, { stdio: 'pipe' });

    // Check final sizes
    const shopSize = fs.statSync(path.join(OUT_DIR, 'shop.mds.zip')).size;
    const inboxSize = fs.statSync(path.join(OUT_DIR, 'mInbox.zip')).size;
    
    console.log(`
╔═══════════════════════════════════════════════════════════╗
║          Build Complete!                                  ║
╚═══════════════════════════════════════════════════════════╝

📁 Output in dist/:
   • shop.mds.zip   → Publish to MiniFS (${(shopSize/1024).toFixed(1)}KB)
   • mInbox.zip     → Install on your node (${(inboxSize/1024).toFixed(1)}KB)
`);

    // Warn if over 50KB
    if (shopSize > 50 * 1024) {
        console.log(`⚠️  WARNING: shop.mds.zip is ${(shopSize/1024).toFixed(1)}KB - exceeds 50KB limit!`);
        console.log('   Consider using a smaller image or removing unnecessary files.\n');
    } else {
        console.log(`✓ Shop package is under 50KB limit\n`);
    }

    console.log(`To deploy:
1. Install mInbox.zip on your Minima node via MDS Hub
2. Publish shop.mds.zip to MiniFS for customers
`);
}

build(process.argv.slice(2));
