import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCsv, safeCsvCell } from './csv';

test('parses quoted commas, escaped quotes, and CRLF rows', () => {
  assert.deepEqual(parseCsv('Institute,Remark\r\nNorth Star,"Asked, then said ""yes"""\r\n'), [
    ['Institute', 'Remark'], ['North Star', 'Asked, then said "yes"'],
  ]);
});

test('rejects malformed quoted CSV', () => {
  assert.throws(() => parseCsv('Institute,Remark\nNorth Star,"not closed'), /unclosed quoted value/);
});

test('prefixes formula-leading values for safe spreadsheet export', () => {
  assert.equal(safeCsvCell('=HYPERLINK("https://example.test")'), '"\'=HYPERLINK(""https://example.test"")"');
  assert.equal(safeCsvCell('Institute name'), '"Institute name"');
});
