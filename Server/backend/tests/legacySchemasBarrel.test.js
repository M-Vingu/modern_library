const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('legacySchemas exports every dedicated validation module export', () => {
  const validationsDir = path.join(__dirname, '..', 'validations');
  const legacySchemas = require('../validations/legacySchemas');
  const schemaFiles = fs
    .readdirSync(validationsDir)
    .filter((file) => file.endsWith('Schemas.js') && file !== 'legacySchemas.js');

  const expectedExports = schemaFiles.reduce((acc, file) => {
    return {
      ...acc,
      ...require(path.join(validationsDir, file)),
    };
  }, {});

  assert.deepEqual(Object.keys(legacySchemas).sort(), Object.keys(expectedExports).sort());
});
