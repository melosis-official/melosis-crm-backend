import test from 'node:test';
import assert from 'node:assert/strict';
import { leadSchema, taskSchema } from './schemas';

test('applies lead defaults and accepts the founder spreadsheet phone format', () => {
  const lead = leadSchema.parse({ instituteName: 'North Star Academy', mobileNumber: '+91 98765 43210' });
  assert.equal(lead.instituteType, 'OTHER');
  assert.equal(lead.source, 'OTHER');
  assert.equal(lead.hasBeenCalled, false);
});

test('rejects malformed email and phone values', () => {
  assert.equal(leadSchema.safeParse({ instituteName: 'Academy', mobileNumber: '00000' }).success, false);
  assert.equal(leadSchema.safeParse({ instituteName: 'Academy', mobileNumber: '9876543210', email: 'invalid' }).success, false);
});

test('requires a related lead and due date for a follow-up', () => {
  assert.equal(taskSchema.safeParse({ title: 'Call back' }).success, false);
  assert.equal(taskSchema.safeParse({ title: 'Call back', leadId: 'lead_1', dueAt: '2026-11-05T10:00:00Z' }).success, true);
});
