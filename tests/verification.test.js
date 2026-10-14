import test from 'node:test';
import assert from 'node:assert/strict';
import { MAX_FILE_SIZE, requiredSlots, validateFile, validateDetails, validateDocuments } from '../src/utils/verification.js';
const details = { role: 'freelancer', name: 'Studio Name', legalName: 'Alex Smith', email: 'alex@example.com', phone: '+91 98765 43210', country: 'India', address: '10 Main St', city: 'Delhi', postalCode: '110001', idType: 'passport' };
const file = (name = 'id.pdf', extra = {}) => ({ name, type: 'application/pdf', size: 1024, lastModified: 1, ...extra });
test('valid professional details and whitespace validation', () => {
  assert.deepEqual(validateDetails(details), {});
  const invalid = validateDetails({ ...details, address: '   ', email: 'invalid', phone: 'abcdefghi' });
  assert.ok(invalid.address); assert.ok(invalid.email); assert.ok(invalid.phone);
  assert.ok(validateDetails({ ...details, legalName: ' ' }).legalName);
  assert.ok(validateDetails({ ...details, role: 'admin' }).role);
});
test('file type, extension, empty files and size limits', () => {
  assert.equal(validateFile(file()), '');
  assert.equal(validateFile(file('id.pdf', { size: MAX_FILE_SIZE })), '');
  for (const invalid of [file('id.exe'), file('id.pdf', { type: 'text/html' }), file('id.pdf', { size: 0 }), file('id.pdf', { size: MAX_FILE_SIZE + 1 })]) assert.ok(validateFile(invalid));
});
test('document requirements depend on role and identity type', () => {
  assert.deepEqual(requiredSlots(details).map(s => s.key), ['front']);
  assert.deepEqual(requiredSlots({ ...details, role: 'salon', idType: 'national_id' }).map(s => s.key), ['front', 'back', 'business']);
  assert.deepEqual(validateDocuments(details, { front: file() }), {});
  assert.ok(validateDocuments({ ...details, idType: 'driving_license' }, { front: file() }).back);
  assert.ok(validateDocuments({ ...details, role: 'salon', businessType: 'registration' }, { front: file() }).business);
});
test('invalid document selections and duplicate sides are rejected', () => {
  assert.ok(validateDocuments({ ...details, idType: 'invalid' }, {}).idType);
  assert.ok(validateDocuments({ ...details, role: 'salon', businessType: 'invalid' }, {}).businessType);
  assert.ok(validateDocuments({ ...details, idType: 'national_id' }, { front: file(), back: file() }).documents);
  assert.deepEqual(validateDocuments({ ...details, idType: 'national_id' }, { front: file(), back: file('back.pdf') }), {});
});
