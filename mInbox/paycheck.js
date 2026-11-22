// mInbox - payment check for a Pocket Shop order coin.
// Pure: loaded by index.html (script tag) and by paycheck.test.js (require).
// Amounts are decimal strings exactly as the node prints them; never floats.

var MXUSD_TOKEN_ID = '0x7D39745FBD29049BE29850B55A18BF550E4D442F930F86266E34193D89042A90';

// The inbox has no shop config of its own: the token is implied by the currency
// label the shop writes into the order ("Minima" or "USDT" = MxUSD).
function tokenIdForCurrency(label) {
    if (label === 'Minima') return '0x00';
    if (label === 'USDT' || label === 'MxUSD') return MXUSD_TOKEN_ID;
    return null;
}

var DECIMAL = /^\d+(\.\d+)?$/;

function compareDecimal(a, b) {
    var pa = a.split('.'), pb = b.split('.');
    var fa = pa[1] || '', fb = pb[1] || '';
    var n = Math.max(fa.length, fb.length);
    var x = BigInt(pa[0] + fa.padEnd(n, '0'));
    var y = BigInt(pb[0] + fb.padEnd(n, '0'));
    return x < y ? -1 : (x > y ? 1 : 0);
}

// received: coin amount (tokenamount for a token coin), or null for a record stored
// before this check existed. total: the order's totalPrice (buyer-supplied).
function checkPayment(received, receivedTokenId, total, shopTokenId) {
    if (received === null || received === undefined) {
        return { status: 'PAID', text: 'paid (not checked by this version)' };
    }
    if (!shopTokenId) {
        return { status: 'UNVERIFIED', text: 'NOT CHECKED: the order names no known shop currency' };
    }
    if (String(receivedTokenId).toUpperCase() !== shopTokenId.toUpperCase()) {
        return { status: 'WRONG-TOKEN', text: 'WRONG TOKEN: paid in ' + receivedTokenId + ' (amount ' + received + ')' };
    }
    var unit = shopTokenId === '0x00' ? 'Minima' : (shopTokenId === MXUSD_TOKEN_ID ? 'MxUSD' : shopTokenId);
    if (!DECIMAL.test(String(received)) || !DECIMAL.test(String(total))) {
        return { status: 'UNVERIFIED', text: 'NOT CHECKED: malformed amount (received "' + received + '", buyer\'s stated total "' + total + '")' };
    }
    var line = 'received ' + received + ' of ' + total + ' ' + unit + ' (buyer\'s stated total)';
    if (compareDecimal(String(received), String(total)) < 0) {
        return { status: 'UNDERPAID', text: 'UNDERPAID: ' + line };
    }
    return { status: 'PAID', text: 'PAID: ' + line };
}

if (typeof module !== 'undefined') {
    module.exports = { checkPayment: checkPayment, tokenIdForCurrency: tokenIdForCurrency, MXUSD_TOKEN_ID: MXUSD_TOKEN_ID };
}
