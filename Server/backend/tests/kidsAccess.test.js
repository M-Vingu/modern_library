const test = require('node:test');
const assert = require('node:assert/strict');

const kidsController = require('../controllers/kidsController');
const KidProfile = require('../models/KidProfile');
const KidContent = require('../models/KidContent');
const ParentControl = require('../models/ParentControl');

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

test('kids: parent cannot access another parent kid content', async () => {
  const originalFindById = KidProfile.findById;
  KidProfile.findById = async () => ({
    _id: 'kid1',
    parentUserId: 'parent-A',
    ageBand: '6-8',
  });

  const req = {
    query: { kidId: '507f1f77bcf86cd799439011' },
    user: { id: 'parent-B', role: 'parent' },
  };
  const res = mockRes();

  await kidsController.listKidContent(req, res);

  KidProfile.findById = originalFindById;
  assert.equal(res.statusCode, 403);
  assert.equal(res.body.error.code, 'KID_FORBIDDEN');
});

test('kids: blocked topics and age filtering are enforced', async () => {
  const originalFindById = KidProfile.findById;
  const originalContentFind = KidContent.find;
  const originalControlFindOne = ParentControl.findOne;

  KidProfile.findById = async () => ({
    _id: 'kid2',
    parentUserId: 'parent-A',
    ageBand: '6-8',
  });
  ParentControl.findOne = async () => ({
    blockedTopics: ['violence'],
    parentUserId: 'parent-A',
  });
  KidContent.find = (filter) => ({
    async sort() {
      assert.equal(filter.ageBandMin.$lte, 8);
      assert.equal(filter.ageBandMax.$gte, 6);
      return [
        { _id: 'c1', topics: ['numbers'], isPublished: true, safetyRating: 'green' },
        { _id: 'c2', topics: ['violence'], isPublished: true, safetyRating: 'green' },
      ];
    },
  });

  const req = {
    query: { kidId: '507f1f77bcf86cd799439011' },
    user: { id: 'parent-A', role: 'parent' },
  };
  const res = mockRes();

  await kidsController.listKidContent(req, res);

  KidProfile.findById = originalFindById;
  KidContent.find = originalContentFind;
  ParentControl.findOne = originalControlFindOne;

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.items.length, 1);
  assert.equal(res.body.items[0]._id, 'c1');
});
