// Run: node --test test/paycheck.test.js
const test = require('node:test');
const assert = require('node:assert');
const { checkPayment, tokenIdForCurrency, MXUSD_TOKEN_ID } = require('../mInbox/paycheck.js');

const MINIMA = '0x00';

test('exact pay is PAID', () => {
    assert.deepStrictEqual(checkPayment('10', MINIMA, '10', MINIMA),
        { status: 'PAID', text: "PAID: received 10 of 10 Minima (buyer's stated total)" });
});

test('over pay is PAID', () => {
    assert.strictEqual(checkPayment('10.5', MINIMA, '10', MINIMA).status, 'PAID');
});

test('under pay by the smallest unit is UNDERPAID', () => {
    const r = checkPayment('9.99999999999999999999999999999999999999999999', MINIMA, '10', MINIMA);
    assert.strictEqual(r.status, 'UNDERPAID');
    assert.strictEqual(r.text, "UNDERPAID: received 9.99999999999999999999999999999999999999999999 of 10 Minima (buyer's stated total)");
});

test('a dust coin carrying an order for 10 items is UNDERPAID', () => {
    assert.strictEqual(checkPayment('0.0001', MINIMA, '10', MINIMA).status, 'UNDERPAID');
});

test('wrong token shows the whole token id', () => {
    assert.deepStrictEqual(checkPayment('10', MINIMA, '10', MXUSD_TOKEN_ID), {
        status: 'WRONG-TOKEN',
        text: 'WRONG TOKEN: paid in 0x00 (amount 10)'
    });
    const other = '0x' + 'AB'.repeat(32);
    assert.strictEqual(checkPayment('10', other, '10', MINIMA).text, 'WRONG TOKEN: paid in ' + other + ' (amount 10)');
});

test('token coin: tokenamount compared at the token scale, MxUSD named', () => {
    const t = tokenIdForCurrency('USDT');
    assert.strictEqual(t, MXUSD_TOKEN_ID);
    assert.deepStrictEqual(checkPayment('12.34', MXUSD_TOKEN_ID.toLowerCase(), '12.340000', t),
        { status: 'PAID', text: "PAID: received 12.34 of 12.340000 MxUSD (buyer's stated total)" });
    assert.strictEqual(checkPayment('12.339999', MXUSD_TOKEN_ID, '12.34', t).status, 'UNDERPAID');
});

test('malformed amounts are never PAID', () => {
    for (const bad of ['', 'abc', '-10', '1e3', ' 10', '10.', '.5', 'NaN', 'Infinity', '0x10', undefined]) {
        assert.strictEqual(checkPayment(bad === undefined ? '' : bad, MINIMA, '10', MINIMA).status, 'UNVERIFIED', 'received ' + bad);
        assert.strictEqual(checkPayment('10', MINIMA, bad, MINIMA).status, 'UNVERIFIED', 'total ' + bad);
    }
    assert.strictEqual(checkPayment('1e-7', MINIMA, '1e-7', MINIMA).status, 'UNVERIFIED');
});

test('unknown currency in the order is not PAID', () => {
    assert.strictEqual(checkPayment('10', MINIMA, '10', tokenIdForCurrency('DOGE')).status, 'UNVERIFIED');
});

test('very long decimal strings compare exactly', () => {
    const big = '123456789012345678901234567890123456789012345678901234567890';
    assert.strictEqual(checkPayment(big + '.000000000000000000000000000000000000001', MINIMA, big, MINIMA).status, 'PAID');
    assert.strictEqual(checkPayment(big, MINIMA, big + '.000000000000000000000000000000000000001', MINIMA).status, 'UNDERPAID');
    // a float would call these equal
    assert.strictEqual(checkPayment('0.30000000000000000', MINIMA, '0.30000000000000001', MINIMA).status, 'UNDERPAID');
});

test('legacy record with no received amount', () => {
    assert.deepStrictEqual(checkPayment(null, null, null, MINIMA),
        { status: 'PAID', text: 'paid (not checked by this version)' });
});
