const test = require('node:test');
const assert = require('node:assert/strict');

const SettlementLedger = require('../models/SettlementLedger');
const { processSettlementGenerationJob } = require('../jobs/worker');

test('settlement worker moves pending settlements into processing', async () => {
  const originalFindById = SettlementLedger.findById;
  let saveCalled = false;

  SettlementLedger.findById = async () => ({
    _id: '507f1f77bcf86cd799439011',
    status: 'pending',
    async save() {
      saveCalled = true;
    },
  });

  const result = await processSettlementGenerationJob({
    data: { settlementId: '507f1f77bcf86cd799439011' },
  });

  SettlementLedger.findById = originalFindById;

  assert.equal(saveCalled, true);
  assert.equal(result.settlementId, '507f1f77bcf86cd799439011');
  assert.equal(result.status, 'processing');
});
