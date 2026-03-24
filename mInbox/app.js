// mInbox - Vendor Inbox for miniFShop Orders
// Follows miniMerch ChainMail protocol

let myPublicKey = VENDOR_CONFIG ? VENDOR_CONFIG.vendorPublicKey : null;
let orders = [];
let currentView = 'inbox';
let currentStatusFilter = 'ALL';
let selectedOrder = null;
let dbReady = false;

function escapeSQL(val) {
    if (val == null) return 'NULL';
    return "'" + String(val).replace(/'/g, "''") + "'";
}

function hexToText(hex) {
    let text = '';
    for (let i = 0; i < hex.length; i += 2) {
        text += String.fromCharCode(parseInt(hex.substr(i, 2), 16));
    }
    return text;
}

function textToHex(text) {
    let hex = '';
    for (let i = 0; i < text.length; i++) {
        hex += text.charCodeAt(i).toString(16).padStart(2, '0');
    }
    return hex;
}

function escapeHtml(text) {
    if (!text) return '';
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function formatDate(timestamp) {
    if (!timestamp) return '-';
    // DB returns BIGINT as string, need to parse
    let ts = typeof timestamp === 'string' ? parseInt(timestamp, 10) : timestamp;
    if (isNaN(ts) || ts <= 0) return '-';
    
    // Handle timestamps that might be in seconds instead of milliseconds
    // If timestamp is less than year 2000 in ms, it's probably in seconds
    if (ts < 946684800000) {
        ts = ts * 1000;
    }
    
    const date = new Date(ts);
    // Check for Invalid Date
    if (isNaN(date.getTime())) return '-';
    
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
}

function getMyPublicKey() {
    return new Promise((resolve) => {
        MDS.cmd('maxima action:info', (response) => {
            if (response.status && response.response && response.response.publickey) {
                resolve(response.response.publickey);
                return;
            }
            resolve(null);
        });
    });
}

function initDatabase(callback) {
    if (dbReady) {
        callback(true);
        return;
    }
    
    // Drop and recreate table to fix schema (read is reserved word)
    MDS.sql("DROP TABLE IF EXISTS orders", function() {
        MDS.sql(
            "CREATE TABLE IF NOT EXISTS orders (" +
            "id INTEGER PRIMARY KEY AUTO_INCREMENT," +
            "ref TEXT, type TEXT, product TEXT, amount TEXT, currency TEXT," +
            "email TEXT, shipping TEXT, message TEXT, timestamp BIGINT," +
            "coinid TEXT UNIQUE, isread INTEGER DEFAULT 0, buyerPublicKey TEXT," +
            "status TEXT DEFAULT 'PAID')",
            function(response) {
                if (response && response.status) {
                    dbReady = true;
                    console.log('mInbox DB ready');
                    callback(true);
                } else {
                    console.log('DB init failed:', JSON.stringify(response));
                    callback(false);
                }
            }
        );
    });
}

function isOrderStored(coinid, callback) {
    MDS.sql(
        "SELECT coinid FROM orders WHERE coinid = " + escapeSQL(coinid),
        function(response) {
            callback(response && response.status && response.rows && response.rows.length > 0);
        }
    );
}

function saveOrderToDb(order, callback) {
    // First check if it exists (H2 doesn't support INSERT OR IGNORE)
    MDS.sql(
        "SELECT coinid FROM orders WHERE coinid = " + escapeSQL(order.coinid || ''),
        function(checkResp) {
            if (checkResp && checkResp.status && checkResp.rows && checkResp.rows.length > 0) {
                console.log('Order already exists in DB:', order.coinid);
                if (callback) callback(true);
                return;
            }
            
            // Insert new order
            MDS.sql(
                "INSERT INTO orders (ref, type, product, amount, currency, email, shipping, message, timestamp, coinid, isread, buyerPublicKey, status) " +
                "VALUES (" +
                escapeSQL(order.ref || '') + ", " +
                escapeSQL(order.type || 'ORDER') + ", " +
                escapeSQL(order.product || '') + ", " +
                escapeSQL(order.amount || '') + ", " +
                escapeSQL(order.currency || '') + ", " +
                escapeSQL(order.email || '') + ", " +
                escapeSQL(order.shipping || '') + ", " +
                escapeSQL(order.message || '') + ", " +
                (order.timestamp || Date.now()) + ", " +
                escapeSQL(order.coinid || '') + ", 0, " +
                escapeSQL(order.buyerPublicKey || '') + ", " +
                escapeSQL(order.status || 'PAID') + ")",
                function(response) {
                    console.log('INSERT response:', JSON.stringify(response));
                    if (response && response.status) {
                        console.log('Order saved:', order.ref);
                    } else {
                        console.log('Order save failed:', response?.error || 'unknown error');
                    }
                    if (callback) callback(response && response.status);
                }
            );
        }
    );
}

function markAsRead(orderId, coinid) {
    MDS.sql(`UPDATE orders SET isread = 1 WHERE coinid = '${coinid}'`, function() {
        loadOrders();
    });
}

function updateOrderStatus(coinid, status) {
    MDS.sql("UPDATE orders SET status = " + escapeSQL(status) + " WHERE coinid = " + escapeSQL(coinid), function(response) {
        if (response && response.status) {
            console.log('Order status updated to:', status);
            loadOrders();
            // Update the modal if open
            if (selectedOrder && selectedOrder.coinid === coinid) {
                selectedOrder.status = status;
                updateStatusDisplay(status);
            }
        }
    });
}

function updateStatusDisplay(status) {
    const statusBtns = document.querySelectorAll('.status-btn');
    statusBtns.forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.status === status) {
            btn.classList.add('active');
        }
    });
}

function updateFilterCounts() {
    const base = currentView === 'inbox' ? orders.filter(o => !o.read) : orders;
    document.getElementById('filter-count-all').textContent       = base.length;
    document.getElementById('filter-count-paid').textContent      = base.filter(o => (o.status || 'PAID') === 'PAID').length;
    document.getElementById('filter-count-preparing').textContent = base.filter(o => o.status === 'PREPARING').length;
    document.getElementById('filter-count-shipped').textContent   = base.filter(o => o.status === 'SHIPPED').length;
}

function renderOrders() {
    const list = document.getElementById('inbox-list');
    let filtered = currentView === 'inbox' ? orders.filter(o => !o.read) : orders;

    // Apply status filter
    if (currentStatusFilter !== 'ALL') {
        filtered = filtered.filter(o => (o.status || 'PAID') === currentStatusFilter);
    }

    document.getElementById('unread-count').textContent = orders.filter(o => !o.read).length;
    document.getElementById('total-count').textContent = orders.length;
    updateFilterCounts();

    if (filtered.length === 0) {
        list.innerHTML = `
            <div class="empty-inbox">
                <div class="empty-icon">📭</div>
                <p>No orders yet</p>
                <p class="empty-hint">Orders from your shop will appear here</p>
            </div>`;
        return;
    }
    
    let html = '';
    filtered.forEach((order, idx) => {
        const statusClass = (order.status || 'PAID').toLowerCase();
        html += `
        <div class="order-item ${order.read ? '' : 'unread'}" data-idx="${idx}">
            <div class="order-icon">📦</div>
            <div class="order-content">
                <div class="order-header">
                    <span class="order-product">${escapeHtml(order.product)}</span>
                    <span class="status-badge status-${statusClass}">${escapeHtml(order.status || 'PAID')}</span>
                </div>
                <div class="order-meta">
                    <span class="order-amount">${escapeHtml(order.amount)} ${escapeHtml(order.currency)}</span>
                    <span class="order-email">${escapeHtml(order.email || 'No email')}</span>
                </div>
                <div class="order-time">${formatDate(order.timestamp)}</div>
            </div>
            <div class="order-arrow">›</div>
        </div>`;
    });
    
    list.innerHTML = html;
    
    list.querySelectorAll('.order-item').forEach(item => {
        item.onclick = () => {
            const idx = parseInt(item.dataset.idx);
            const order = filtered[idx];
            openOrderModal(order);
        };
    });
}

function openOrderModal(order) {
    selectedOrder = order;
    
    document.getElementById('modal-title').textContent = order.product || 'Order';
    document.getElementById('modal-ref').textContent = order.ref || '-';
    document.getElementById('modal-txid').textContent = order.coinid || '-';
    
    const currentStatus = order.status || 'PAID';
    
    let infoHtml = `
        <div class="info-row"><span class="label">Amount:</span><span class="value">${escapeHtml(order.amount)} ${escapeHtml(order.currency)}</span></div>
        <div class="info-row"><span class="label">Email:</span><span class="value">${escapeHtml(order.email || 'Not provided')}</span></div>
        <div class="info-row"><span class="label">Shipping:</span><span class="value shipping-address">${escapeHtml(order.shipping || 'Not provided')}</span></div>
        ${order.message ? `<div class="info-row"><span class="label">Message:</span><span class="value">${escapeHtml(order.message)}</span></div>` : ''}
        <div class="info-row"><span class="label">Time:</span><span class="value">${formatDate(order.timestamp)}</span></div>
        ${order.buyerPublicKey ? `<div class="info-row buyer-mx-row"><span class="label">Buyer MX:</span><span class="value pubkey-copy" id="buyer-pubkey" title="Click to copy">${escapeHtml(order.buyerPublicKey)}</span></div>` : ''}`;
    
    document.getElementById('modal-info').innerHTML = infoHtml;
    
    // Make buyer pubkey clickable to copy
    const buyerPubkeyEl = document.getElementById('buyer-pubkey');
    if (buyerPubkeyEl) {
        buyerPubkeyEl.onclick = function() {
            navigator.clipboard.writeText(order.buyerPublicKey);
            this.textContent = '✓ Copied!';
            setTimeout(() => {
                this.textContent = order.buyerPublicKey;
            }, 1500);
        };
    }
    
    // Update status buttons
    document.querySelectorAll('.status-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.status === currentStatus) {
            btn.classList.add('active');
        }
    });
    
    // Update ChainMail button state
    const chainmailBtn = document.getElementById('open-chainmail-btn');
    if (chainmailBtn) {
        chainmailBtn.disabled = !order.buyerPublicKey;
    }
    
    document.getElementById('message-modal').classList.remove('hidden');
    
    if (!order.read) {
        markAsRead(order.id, order.coinid);
    }
}

document.getElementById('modal-close').onclick = function() {
    document.getElementById('message-modal').classList.add('hidden');
    selectedOrder = null;
};

document.getElementById('copy-address-btn').onclick = function() {
    if (selectedOrder && selectedOrder.shipping) {
        navigator.clipboard.writeText(selectedOrder.shipping);
        this.textContent = '✓ Copied!';
        setTimeout(() => this.textContent = '📋 Copy Address', 2000);
    }
};

document.getElementById('copy-txid-btn').onclick = function() {
    if (selectedOrder && selectedOrder.coinid) {
        navigator.clipboard.writeText(selectedOrder.coinid);
        this.textContent = '✓ Copied!';
        setTimeout(() => this.textContent = 'Copy', 2000);
    }
};

// Status button handlers
document.querySelectorAll('.status-btn').forEach(btn => {
    btn.onclick = function() {
        if (!selectedOrder) return;
        const newStatus = this.dataset.status;
        updateOrderStatus(selectedOrder.coinid, newStatus);
    };
});

// ChainMail dapplink handler
document.getElementById('open-chainmail-btn').onclick = function() {
    if (!selectedOrder) return;
    
    if (!selectedOrder.buyerPublicKey) {
        alert('No buyer public key available for this order');
        return;
    }
    
    const btn = this;
    btn.disabled = true;
    btn.textContent = 'Copying...';
    
    // Copy buyer's MX pubkey to clipboard first
    navigator.clipboard.writeText(selectedOrder.buyerPublicKey).then(function() {
        console.log('Buyer MX pubkey copied to clipboard:', selectedOrder.buyerPublicKey);
        btn.textContent = 'Opening...';
        
        MDS.dapplink("chainmail", function(linkdata) {
            if (linkdata.status) {
                // Open ChainMail - buyer pubkey is already in clipboard
                const url = linkdata.base;
                console.log('Opening ChainMail:', url);
                window.open(url, '_blank');
                btn.textContent = '✓ Copied & Opened';
                setTimeout(() => {
                    btn.textContent = '💬 Open ChainMail';
                    btn.disabled = false;
                }, 2000);
            } else {
                alert('ChainMail minidapp not found. Please install ChainMail.\n\nBuyer address copied to clipboard.');
                console.log('ChainMail dapplink error:', linkdata.error);
                btn.textContent = '💬 Open ChainMail';
                btn.disabled = false;
            }
        });
    }).catch(function(err) {
        console.error('Failed to copy to clipboard:', err);
        alert('Failed to copy buyer address to clipboard');
        btn.textContent = '💬 Open ChainMail';
        btn.disabled = false;
    });
};

document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.onclick = function() {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        currentStatusFilter = this.dataset.filter;
        renderOrders();
    };
});

document.querySelectorAll('.inbox-tab').forEach(tab => {
    tab.onclick = function() {
        document.querySelectorAll('.inbox-tab').forEach(t => t.classList.remove('active'));
        this.classList.add('active');
        currentView = this.dataset.view;
        renderOrders();
    };
});

function csvEscape(val) {
    const str = String(val == null ? '' : val);
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
        return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
}

function exportToCSV(rows) {
    const headers = [
        'Reference', 'Product', 'Amount', 'Currency',
        'Email', 'Shipping Address', 'Message',
        'Status', 'Date', 'Time',
        'TX ID', 'Buyer MX Key', 'Read'
    ];

    const lines = rows.map(o => {
        const ts  = o.timestamp ? new Date(parseInt(o.timestamp) < 946684800000 ? parseInt(o.timestamp) * 1000 : parseInt(o.timestamp)) : null;
        const date = ts && !isNaN(ts) ? ts.toLocaleDateString() : '';
        const time = ts && !isNaN(ts) ? ts.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
        return [
            o.ref, o.product, o.amount, o.currency,
            o.email, o.shipping, o.message,
            o.status || 'PAID', date, time,
            o.coinid, o.buyerPublicKey || '', o.read ? 'yes' : 'no'
        ].map(csvEscape).join(',');
    });

    return [headers.join(','), ...lines].join('\n');
}

function downloadFile(data, filename, mimeType) {
    const blob = new Blob([data], { type: mimeType });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

document.getElementById('export-csv-btn').onclick = function() {
    // Export what the user currently sees (respects view + status filter)
    let rows = currentView === 'inbox' ? orders.filter(o => !o.read) : orders;
    if (currentStatusFilter !== 'ALL') {
        rows = rows.filter(o => (o.status || 'PAID') === currentStatusFilter);
    }

    if (rows.length === 0) {
        alert('No orders to export with the current filter.');
        return;
    }

    const filterSuffix = currentStatusFilter !== 'ALL' ? '_' + currentStatusFilter.toLowerCase() : '';
    const date         = new Date().toISOString().split('T')[0];
    const filename     = `minifshop_orders_${date}${filterSuffix}.csv`;
    downloadFile(exportToCSV(rows), filename, 'text/csv;charset=utf-8;');
};

document.getElementById('refresh-btn').onclick = function() {
    console.log('Refresh clicked - scanning for orders...');
    scanForOrders();
    loadOrders();
};

function loadOrders() {
    MDS.sql("SELECT * FROM orders ORDER BY timestamp DESC", function(res) {
        if (res && res.status && res.rows) {
            orders = res.rows.map(row => ({
                id: row.ID,
                ref: row.REF,
                type: row.TYPE,
                product: row.PRODUCT,
                amount: row.AMOUNT,
                currency: row.CURRENCY,
                email: row.EMAIL,
                shipping: row.SHIPPING,
                message: row.MESSAGE,
                timestamp: row.TIMESTAMP,
                coinid: row.COINID,
                read: row.ISREAD === 1,
                buyerPublicKey: row.BUYERPUBLICKEY,
                status: row.STATUS || 'PAID'
            }));
            renderOrders();
        }
    });
}

function tryDecryptMessage(coinid, stateData, callback) {
    let cleanData = stateData;
    if (cleanData && cleanData.startsWith('0x')) cleanData = cleanData.substring(2);
    
    console.log('Attempting decrypt, data preview:', cleanData ? cleanData.substring(0, 80) + '...' : 'null');
    
    MDS.cmd('maxmessage action:decrypt data:' + cleanData, function(response) {
        console.log('Decrypt response status:', response?.status);
        console.log('Decrypt response valid:', response?.response?.message?.valid);
        
        if (!response || !response.status) {
            console.log('Decryption failed - no response or status false');
            callback(null);
            return;
        }
        
        // Check if decryption was valid (ChainMail pattern)
        const valid = response.response && response.response.message && response.response.message.valid;
        if (!valid) {
            console.log('Decryption failed - message not valid for us');
            callback(null);
            return;
        }
        
        try {
            let hexData = response.response.message.data;
            if (!hexData) {
                console.log('Decryption failed - no data in message');
                callback(null);
                return;
            }
            if (hexData.startsWith('0x')) hexData = hexData.substring(2);
            
            let text = '';
            for (let i = 0; i < hexData.length; i += 2) {
                text += String.fromCharCode(parseInt(hexData.substr(i, 2), 16));
            }
            
            console.log('Decrypted text:', text.substring(0, 100) + '...');
            
            const decrypted = JSON.parse(text);
            decrypted._senderPublicKey = response.response.message.mxpublickey || null;
            
            console.log('Decrypted order:', JSON.stringify({ type: decrypted.type, ref: decrypted.ref }));
            callback(decrypted);
        } catch (e) {
            console.log('Decrypt parse error:', e.message);
            callback(null);
        }
    });
}

function processOrderCoin(coin) {
    console.log('Processing coin:', coin.coinid || coin.txid, 'address:', coin.address);
    
    let state99 = null;
    if (coin.state) {
        console.log('Coin has state:', coin.state);
        for (let s of coin.state) {
            if (s.port === 99 || s.port === '99') {
                state99 = s.data;
                console.log('Found state99:', state99 ? state99.substring(0, 50) + '...' : null);
                break;
            }
        }
    }
    
    if (!state99) {
        console.log('No state99 found for coin');
        return;
    }
    
    const coinid = coin.coinid || coin.txid || '';
    
    tryDecryptMessage(coinid, state99, function(decrypted) {
        if (!decrypted) return;
        
        if (decrypted.type === 'ORDER') {
            console.log('Processing ORDER type, coinid:', coinid);
            isOrderStored(coinid, function(stored) {
                console.log('isOrderStored result:', stored, 'for coinid:', coinid);
                if (stored) {
                    console.log('Order already stored, skipping');
                    return;
                }
                
                const order = {
                    ref: decrypted.ref || 'ORDER-' + Date.now(),
                    type: decrypted.type,
                    product: decrypted.product || 'miniFShop',
                    amount: decrypted.amount || '1',
                    currency: decrypted.currency || 'MINI',
                    email: decrypted.email || '',
                    shipping: decrypted.shipping || '',
                    message: decrypted.message || '',
                    timestamp: decrypted.timestamp || Date.now(),
                    coinid: coinid,
                    read: false,
                    // Prefer explicitly sent MX key, fallback to decryption sender key
                    buyerPublicKey: decrypted.buyerMxKey || decrypted._senderPublicKey || ''
                };
                console.log('Buyer MX key for ChainMail:', order.buyerPublicKey);
                
                console.log('Saving order to DB:', order.ref);
                saveOrderToDb(order, function(success) {
                    console.log('saveOrderToDb result:', success);
                    loadOrders();
                });
            });
        } else if (decrypted.type === 'REPLY') {
            // Handle buyer replies
            console.log('Received reply:', decrypted.ref);
        }
    });
}

function scanForOrders() {
    console.log('Scanning for orders at VENDOR_ADDRESS:', VENDOR_ADDRESS);
    MDS.cmd('coins address:' + VENDOR_ADDRESS, function(response) {
        console.log('Coins response:', response);
        if (!response) {
            console.log('No response from coins command');
            return;
        }
        if (!response.status) {
            console.log('Coins command failed:', response.error || response);
            return;
        }
        if (!response.response) {
            console.log('No response data');
            return;
        }
        
        let coins = response.response;
        if (typeof coins === 'string') {
            try { coins = JSON.parse(coins); } catch (e) { return; }
        }
        if (!Array.isArray(coins)) {
            console.log('Coins is not an array:', typeof coins);
            return;
        }
        
        console.log('Found', coins.length, 'coins at VENDOR_ADDRESS');
        
        coins.forEach(function(coin) {
            processOrderCoin(coin);
        });
    });
}

MDS.init(async function(msg) {
    if (msg.event === 'inited') {
        initDatabase(function(ok) {
            if (ok) {
                loadOrders();
                
                MDS.cmd('coinnotify action:add address:' + VENDOR_ADDRESS, function(resp) {
                    console.log('Coin notify registered:', JSON.stringify(resp));
                });
                
                scanForOrders();
            }
        });
    }
    
    if (msg.event === 'NOTIFYCOIN') {
        const coin = msg.data && msg.data.coin;
        if (!coin || coin.address !== VENDOR_ADDRESS) return;
        
        processOrderCoin(coin);
    }
    
    if (msg.event === 'MDS_TIMER_10SECONDS') {
        scanForOrders();
    }
});
