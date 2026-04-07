const test = require('node:test');
const assert = require('node:assert/strict');

const Partner = require('../models/Partner');
const CabVehicle = require('../models/CabVehicle');
const { createCabVehicle } = require('../controllers/partnerController');
const { createMockRes } = require('./testUtils');

test('createCabVehicle blocks non-owner non-admin users', async () => {
  const originalFindById = Partner.findById;
  const originalCreate = CabVehicle.create;

  Partner.findById = async () => ({
    _id: '507f1f77bcf86cd799439011',
    ownerUserId: '507f1f77bcf86cd799439099',
    verificationStatus: 'approved',
  });

  let createCalled = false;
  CabVehicle.create = async () => {
    createCalled = true;
    return {};
  };

  const req = {
    params: { partnerId: '507f1f77bcf86cd799439011' },
    user: { id: '507f1f77bcf86cd799439012', role: 'user' },
    body: { plateNumber: 'KAA 111A' },
  };
  const res = createMockRes();

  await createCabVehicle(req, res);

  Partner.findById = originalFindById;
  CabVehicle.create = originalCreate;

  assert.equal(res.statusCode, 403);
  assert.equal(createCalled, false);
});
