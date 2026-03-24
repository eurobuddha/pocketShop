# miniFShop

A lightweight MiniDapp shop template for selling products on the Minima blockchain. Includes a customer-facing shop and vendor inbox for managing orders.

## Features

- **Shop MiniDapp**: Accept orders with encrypted buyer details
- **Vendor Inbox (mInbox)**: Receive and manage orders
- **ChainMail Integration**: Reply to buyers via ChainMail
- **Order Status Tracking**: PAID → PREPARING → SHIPPED
- **Quantity Selector**: Support for multiple units per order

## Quick Start

### Prerequisites

- Minima wallet with MDS (MiniDapp System) enabled
- Node.js (for building)

### 1. Get Your Credentials

From your Minima wallet:
- **Address**: Your wallet address (0x...)
- **Public Key**: Get via `maxima action:info` in MDS terminal

### 2. Build Your Shop

```bash
node build-miniFShop.js <address> <pubkey> [options]

Options:
  --name <name>         Product name (default: "Product")
  --description <desc>  Product description
  --price <price>       Price per unit in MINI (default: 1)
  --max-units <max>     Maximum units per order (default: 10)
  --image <path>        Path to product image (SVG/PNG/JPG)
```

Example:
```bash
node build-miniFShop.js 0xA65ED661... MxG18HGG... \
  --name "Organic Honey" \
  --description "Pure raw honey from local bees" \
  --price 2.5 \
  --max-units 5
```

### 3. Deploy

1. **Install mInbox** on your node:
   - Upload `dist/mInbox.zip` via MDS Hub

2. **Publish shop** to MiniFS:
   - Upload `dist/shop.mds.zip` to MiniFS

## How It Works

### Order Flow

1. Customer opens shop MiniDapp
2. Selects quantity and fills order form
3. Order data is encrypted with vendor's public key
4. Payment + encrypted order sent as single transaction
5. Vendor receives order in mInbox

### ChainMail Replies

- mInbox displays buyer's MX public key
- Click "Open ChainMail" to copy address and open ChainMail app
- Send encrypted replies directly to buyer

## File Structure

```
miniFShop/
├── build-miniFShop.js       # Build script
├── mInbox/              # Vendor inbox MiniDapp
│   ├── index.html
│   ├── app.js
│   ├── config.js
│   ├── style.css
│   ├── mds.js
│   └── icon.svg
└── miniFShop-shop/          # Shop MiniDapp template
    ├── index.template.html
    ├── style.css
    ├── config.js
    ├── dapp.conf
    ├── icon.svg
    └── product.svg
```

## Requirements

- Shop package must be under 50KB
- Use SVG images for smallest size
- PNG/JPG accepted but warn if >10KB

## License

MIT
