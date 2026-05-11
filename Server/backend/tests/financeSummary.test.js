const test = require('node:test');
const assert = require('node:assert/strict');

const SettlementLedger = require('../models/SettlementLedger');
const { financeSummary } = require('../controllers/businessController');
const { createMockRes } = require('./testUtils');

test('financeSummary combines paid and legacy settled settlement states', async () => {
  const originalAggregate = SettlementLedger.aggregate;
  const seenMatches = [];

  SettlementLedger.aggregate = async (pipeline) => {
    seenMatches.push(pipeline[0].$match);
    const match = pipeline[0].$match;
    if (match.status === 'pending') return [{ gross: 100, payout: 90, commission: 10 }];
    if (match.status === 'processing') return [{ gross: 50, payout: 45, commission: 5 }];
    if (Array.isArray(match.status?.$in)) return [{ gross: 75, payout: 65, commission: 10 }];
    return [];
  };

  const req = { user: { id: '507f1f77bcf86cd799439011', role: 'admin' } };
  const res = createMockRes();

  await financeSummary(req, res);

  SettlementLedger.aggregate = originalAggregate;

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body.pending, { gross: 100, payout: 90, commission: 10 });
  assert.deepEqual(res.body.processing, { gross: 50, payout: 45, commission: 5 });
  assert.deepEqual(res.body.paid, { gross: 75, payout: 65, commission: 10 });
  assert.deepEqual(seenMatches[2], { status: { $in: ['paid', 'settled'] } });
});
