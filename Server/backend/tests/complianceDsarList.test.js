const test = require('node:test');
const assert = require('node:assert/strict');

const compliance = require('../controllers/complianceController');
const DSARRequest = require('../models/DSARRequest');

function mockRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
    fail(status, code, message, details) {
      this.statusCode = status;
      this.body = { success: false, error: { code, message, details } };
      return this;
    },
  };
}

test('compliance: dsar list enforces admin', async () => {
  const req = { user: { id: 'u1', role: 'student' }, query: {} };
  const res = mockRes();

  await compliance.listDsarRequests(req, res);

  assert.equal(res.statusCode, 403);
  assert.equal(res.body.error.code, 'COMPLIANCE_FORBIDDEN');
});

test('compliance: dsar list applies filter and pagination', async () => {
  const originalFind = DSARRequest.find;
  const originalCount = DSARRequest.countDocuments;

  let observedFilter = null;
  DSARRequest.find = (filter) => {
    observedFilter = filter;
    return {
      sort() { return this; },
      skip() { return this; },
      limit() { return this; },
      async populate() {
        return [{ _id: 'r1', requestType: 'export', status: 'requested' }];
      },
    };
  };
  DSARRequest.countDocuments = async () => 1;

  const req = {
    user: { id: 'admin-1', role: 'admin' },
    query: { requestType: 'export', status: 'requested', page: '2', limit: '10' },
  };
  const res = mockRes();

  await compliance.listDsarRequests(req, res);

  DSARRequest.find = originalFind;
  DSARRequest.countDocuments = originalCount;

  assert.equal(res.statusCode, 200);
  assert.equal(observedFilter.requestType, 'export');
  assert.equal(observedFilter.status, 'requested');
  assert.equal(res.body.page, 2);
  assert.equal(res.body.limit, 10);
  assert.equal(res.body.total, 1);
  assert.equal(res.body.items.length, 1);
});
