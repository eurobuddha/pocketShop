# 🛍 Pocket Shop

A lightweight shop template for selling products on the **Minima blockchain**. Accept payments in MINI or USDT. Orders are encrypted on-chain — only you (the vendor) can read them.

---

## ⚡ Quick Start

Get from zero to a deployed shop in about 5 minutes:

1. **Download Studio** — Grab the installer for your OS from [Releases](https://github.com/eurobuddha/pocketShop/releases)
   - macOS: Open `.dmg`, drag app to Applications
   - Windows: Run `.exe` installer (no admin needed)

2. **Launch Studio** — Open the app, it automatically opens `http://localhost:3456` in your browser

3. **Vendor Setup** — Click the **Vendor Setup** tab:
   - Enter your **Minima address** (from Wallet → Receive)
   - Enter your **MX public key** (in MDS Terminal: `maxima action:info`, copy `mxpublickey`)
   - Click **Save Configuration**

4. **Build Your Shop** — Click **Build Shop** tab:
   - Product name, description, price, max units
   - Optional: drag & drop a product image
   - Click **Build Shop**

5. **Deploy** — Two files were created in `dist/`:
   - `mInbox.zip` → Install on **your** Minima node (MDS Hub → Install MiniDapp)
   - `[productname].mds.zip` → Upload to **MiniFS** (MiniFS MiniDapp → Upload), then share the link with customers!

**That's it!** Orders from customers will appear in your mInbox automatically.

---

## 🤔 What is Pocket Shop?

Pocket Shop is three things bundled together:

| Component | Who uses it | What it does |
|---|---|---|
| **Shop MiniDapp** | Your customers | Displays your product, collects order details, processes payment |
| **mInbox MiniDapp** | You (the vendor) | Receives and decrypts orders, manages order status, replies to buyers |
| **Studio** | You (the builder) | Desktop app (or CLI) that generates the shop + inbox packages |

You don't need to write code. Studio handles everything — you just fill in your product details.

---

## 🔄 How It Works

Here's what happens when a customer buys something:

```
┌──────────────┐                              ┌──────────────┐      ┌──────────────┐
│   Customer  │                              │    Minima    │      │   Vendor    │
│             │  1. Fills form (email, addr) │   Blockchain │      │  (mInbox)    │
│             │ ─────────────────────────►   │              │      │              │
│             │                              │              │      │              │
│             │  2. Order encrypted with     │              │      │              │
│             │     your MX public key      │              │      │              │
│             │ ─────────────────────────►   │              │      │              │
│             │                              │    3. Order  │      │              │
│             │     Payment + encrypted     │    saved on  │      │              │
│             │     order sent on-chain     │    chain     │ ──►  │              │
│             │ ─────────────────────────►   │              │      │              │
│             │                              │              │      │  4. Decrypt  │
│             │                              │              │      │     order    │
│             │                              │              │      │ ──────────►  │
│             │  5. TX shown as confirmation │              │      │              │
└──────────────┘                              └──────────────┘      └──────────────┘
```

1. Customer fills in their email, shipping address, and an optional message
2. The order is **encrypted with your Maxima public key** — only you can read it
3. A single Minima transaction sends the payment **and** the encrypted order
4. Your mInbox automatically detects the incoming coin, decrypts the order, and saves it
5. Customer sees the transaction ID as confirmation

**What's on the blockchain?** Only the encrypted blob and the payment amount. No email, no address, no buyer details are visible publicly.

---

## 📋 Prerequisites

Before you start, you'll need:

| Requirement | How to get it |
|---|---|
| **Minima node** with MDS enabled | Run Minima (instructions at [minima.global](https://minima.global)) |
| **Minima wallet address** | Open Wallet MiniDapp → Receive tab |
| **Maxima public key** | In MDS Terminal: `maxima action:info` → copy `mxpublickey` |

---

## 🖥️ Option A: Studio Desktop App (Recommended)

Studio is a local web app that runs on your computer. It builds shops without any terminal commands.

### Download & Install

Get the latest version from [Releases](https://github.com/eurobuddha/pocketShop/releases):

| OS | File | Install method |
|---|---|---|
| **macOS** | `PocketShop-Studio-X.X.X.dmg` | Open → drag to Applications → double-click |
| **Windows** | `PocketShop-Studio-X.X.X-Setup.exe` | Double-click → install → launch from Start Menu |

> **First launch on macOS:** Right-click the app → Open → click "Open" (bypasses Gatekeeper)
> **First launch on Windows:** Click "More info" → "Run anyway" (bypasses SmartScreen)

### Using Studio

Studio opens automatically at `http://localhost:3456`. You'll see two tabs:

#### Tab 1: Vendor Setup

```
┌─────────────────────────────────────────────────────────┐
│  Pocket Shop Studio                      [Setup] [Build]  │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Vendor Setup                                           │
│  ───────────                                            │
│                                                         │
│  Minima Address                                         │
│  ┌─────────────────────────────────────┐  (required)   │
│  │ 0x465CA86A9B5756F45DEB667A69B3...  │               │
│  └─────────────────────────────────────┘               │
│                                                         │
│  MX Public Key                                          │
│  ┌─────────────────────────────────────┐  (required)   │
│  │ MxG18HGG6FJ...                       │               │
│  └─────────────────────────────────────┘               │
│                                                         │
│              [ Save Configuration ]                     │
└─────────────────────────────────────────────────────────┘
```

- **Minima Address**: Your wallet address (starts with `0x`)
- **MX Public Key**: From `maxima action:info` in MDS Terminal

Click **Save Configuration**. Your details are stored locally at `~/.pocketshop/config.json`.

#### Tab 2: Build Shop

```
┌─────────────────────────────────────────────────────────┐
│  Pocket Shop Studio                      [Setup] [Build]  │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Build Your Shop                                        │
│  ─────────────                                          │
│                                                         │
│  Product name:  [ Organic Honey        ]                │
│                                                         │
│  Description:  [ Raw honey from local bees              │
│                 in the mountains          ]             │
│                                                         │
│  Price:      [ 2.5 ]  Currency: [Minima] [USDT]         │
│  Max units:  [ 5  ]                                     │
│                                                         │
│  Image:      [drag & drop or browse]                    │
│                                                         │
│              [ 🏗️  Build Shop ]                         │
└─────────────────────────────────────────────────────────┘
```

Fill in your product details:
- **Product name** — What you're selling (max 120 chars)
- **Description** — Brief description (max 300 chars)
- **Price** — Per unit
- **Currency** — MINI or USDT
- **Max units** — Maximum quantity per order
- **Image** — Optional product image (SVG recommended for small size)

Click **Build Shop**. When complete, you'll get download links for:
- `[productname].mds.zip` — The shop MiniDapp (share this with customers)
- `mInbox.zip` — Your order inbox (install on your Minima node)

### Deploying Your Shop

**Step 1: Install mInbox on your node**

1. Open your **MDS Hub** (`http://localhost:9003` or your node's MDS port)
2. Click **Install MiniDapp**
3. Upload `mInbox.zip`
4. Open mInbox from your MDS app list — it starts scanning for orders immediately

**Step 2: Publish the shop to MiniFS**

1. Open the **MiniFS** MiniDapp in your MDS Hub (install it if needed)
2. Upload `[productname].mds.zip`
3. Copy the generated MiniFS link
4. Share that link with customers!

> **Size tip:** Shop packages must be under **50 KB**. Use SVG images to stay well under this limit.

---

## 💻 Option B: CLI Build

Prefer the terminal? You can build shops from the command line:

```bash
git clone https://github.com/eurobuddha/pocketShop.git
cd pocketShop
npm install
```

```bash
node build-pocketshop.js <address> <pubkey> [options]
```

| Option | Description | Default |
|---|---|---|
| `<address>` | Your Minima wallet address (`0x...`) | required |
| `<pubkey>` | Your Maxima public key (`Mx...`) | required |
| `--name` | Product name | `"Product"` |
| `--description` | Product description | — |
| `--price` | Price per unit | `1` |
| `--max-units` | Maximum units per order | `10` |
| `--image` | Path to product image (SVG/PNG/JPG) | default SVG |

**Example:**

```bash
node build-pocketshop.js \
  0xA65ED661F4B6580AC93BEA7E07A36D98CF3EA0E2F3B5D1E7A92C4B6F0D3E5A1 \
  MxG18HGG4D3F2A1B9C7E6D5F4A3B2C1D0E9F8A7B6C5D4E3F2A1B0C9D8E7F6A5B4 \
  --name "Organic Honey" \
  --description "Pure raw honey from local bees" \
  --price 2.5 \
  --max-units 5 \
  --image ./honey.svg
```

Output in `dist/`:
```
dist/
├── organic-honey.mds.zip   # Shop MiniDapp
└── mInbox.zip              # Vendor inbox
```

---

## 📬 Managing Orders with mInbox

Once mInbox is installed on your Minima node, it automatically finds and decrypts incoming orders.

### The mInbox Interface

```
┌─────────────────────────────────────────────────────────┐
│  mInbox — Orders (3 unread)                             │
├─────────────────────────────────────────────────────────┤
│  [All ▼] [Unread ▼]                          [Search]   │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  🟡 Order #1234 — 2x Organic Honey                     │
│     PAID • 5 MINI • john@email.com • 2 min ago        │
│                                                         │
│  🟢 Order #1233 — 1x Organic Honey                     │
│     SHIPPED • 2.5 MINI • jane@email.com • 1 day ago   │
│                                                         │
│  🔵 Order #1232 — 3x Organic Honey                     │
│     PREPARING • 7.5 MINI • bob@email.com • 3 days ago │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Order Status Flow

Orders move through three states:

| Status | Meaning | Action |
|---|---|---|
| **PAID** | Payment received, awaiting fulfillment | Start preparing |
| **PREPARING** | Order is being packed/shipped | Update when ready |
| **SHIPPED** | On its way to the customer | Mark as complete |

Click an order to see full details (email, shipping address, message) and update the status.

### Replying to Customers

Each order includes the customer's **Maxima public key**. To reply:

1. Open the order in mInbox
2. Click **Open ChainMail**
3. The customer's public key is copied to your clipboard
4. Paste it into ChainMail and send your message

All replies are end-to-end encrypted.

---

## ❓ FAQ

### General

**Q: Does Pocket Shop support both MINI and USDT?**
A: Yes! Choose your currency when building the shop. USDT is the bridged version on Minima.

**Q: Can I sell multiple products in one shop?**
A: Currently each shop sells one product. For multiple products, you'd build separate shops (e.g., `honey.mds.zip`, `beeswax.mds.zip`).

**Q: What's the difference between MiniFS and MDS?**
A: MDS runs apps on your local node. MiniFS is a file storage system — files published there can be accessed by anyone on the network via a link.

### Installation

**Q: "Connection refused" when opening Studio**
A: Make sure the Studio app is running. Check that port 3456 isn't used by another app.

**Q: "Invalid public key" when saving vendor setup**
A: MX public keys start with `Mx`. Make sure you copied the full key from `maxima action:info`.

**Q: Can I run Studio without installing?**
A: Yes! Run `npm run studio` from the project directory.

### Orders

**Q: Orders aren't appearing in mInbox**
A: Check:
1. mInbox is installed and running on your MDS Hub
2. You're using the same Minima address that customers pay to
3. Wait a minute — there's a slight delay as mInbox scans the chain

**Q: Can I issue refunds?**
A: Not directly through mInbox. You'd send a regular Minima transaction to refund the customer's address (visible in the order details).

### Shop Size

**Q: "Package too large" when uploading to MiniFS**
A: MiniFS has a 50 KB limit. Solutions:
- Use SVG instead of PNG/JPG images
- Compress your images
- Reduce description text
- The Studio shows a warning if you're close to the limit

---

## 🔐 Security Model

### What's Encrypted?

When a customer places an order, these fields are encrypted with your Maxima public key:

- Customer's email address
- Shipping address
- Optional message
- Customer's Maxima public key (so you can reply via ChainMail)

### What's Public?

| Data | Visible on-chain? |
|---|---|
| Payment amount | ✅ Yes |
| Vendor address | ✅ Yes |
| Buyer address | ✅ Yes (from sending coin) |
| Encrypted order blob | ✅ Yes, but unreadable without your private key |
| Email, address, message | ❌ No (inside encrypted blob) |

### Security Best Practices

- **Your private key never leaves your node** — encryption/decryption happens locally
- **mInbox uses parameterized SQL** — prevents injection attacks
- **All output is HTML-escaped** — prevents XSS attacks

---

## 📁 File Structure

```
pocketShop/
│
├── studio.js                   # Studio server (Node.js, port 3456)
├── studio-builder.js           # Shop/inbox zip generator
├── build-pocketshop.js          # CLI build entry point
│
├── web/                       # Studio web UI
│   ├── index.html             # Two-tab UI
│   ├── app.js                 # Frontend logic
│   └── style.css
│
├── pocketshop-shop/            # Shop MiniDapp template
│   ├── index.template.html    # HTML template
│   ├── config.js              # Vendor config (generated)
│   ├── dapp.conf              # MDS manifest
│   └── ...
│
├── mInbox/                    # Vendor inbox MiniDapp
│   ├── index.html             # Inbox UI
│   ├── app.js                 # Order handling
│   └── ...
│
├── build/                     # Installer build scripts
│   ├── build-mac.sh           # macOS .dmg builder
│   ├── build-win.sh           # Windows .exe builder
│   └── installer.nsi           # NSIS script
│
├── dist/                      # Generated MiniDapps
│   ├── [product].mds.zip
│   └── mInbox.zip
│
└── release/                   # Installer output
    ├── PocketShop-Studio-*.dmg
    └── PocketShop-Studio-*.exe
```

---

## 🏗️ Building Installers

Want to contribute or build your own installers? Here's how:

### macOS

```bash
npm run build:mac
```

Output: `release/PocketShop-Studio-X.X.X.dmg`

Requirements: Node.js, macOS (uses Xcode tools for signing)

### Windows

```bash
npm run build:win
```

Output: `release/PocketShop-Studio-X.X.X-Setup.exe`

Requirements: `makensis` (NSIS), ImageMagick (`convert`)

### Running Studio without installing

```bash
npm run studio
# Opens http://localhost:3456
```

---

## 📄 License

MIT — use it however you like.
