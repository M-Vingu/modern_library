const test = require('node:test');
const assert = require('node:assert/strict');

const kidsController = require('../controllers/kidsController');
const KidProfile = require('../models/KidProfile');

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

test('kids: parent control update forbidden across parents', async () => {
  const originalFindById = KidProfile.findById;
  KidProfile.findById = async () => ({ _id: 'kid-x', parentUserId: 'parent-A' });

  const req = {
    params: { kidId: '507f1f77bcf86cd799439011' },
    body: { dailyScreenLimitMin: 20 },
    user: { id: 'parent-B', role: 'parent' },
  };
  const res = mockRes();

  await kidsController.upsertParentControl(req, res);

  KidProfile.findById = originalFindById;
  assert.equal(res.statusCode, 403);
  assert.equal(res.body.error.code, 'KID_FORBIDDEN');
});
