import { describe, expect, it } from 'vitest';
import { strFromU8, unzipSync } from 'fflate';
import { formIsDirty, reconcileSavedValues, validateContact } from '@/shared/forms';
import { localize, createGlobalization } from '@/shared/globalization';
import { assertApiPath, confirmCommand } from '@/shared/http';
import { createCsv, createWorkbook } from '@/shared/export';
import { safeReturnPath, sessionDeadline } from '@/app/session';
import { localDateInput, localDateInstant, localDateTimeInput, localDateTimeInstant } from '@/shared/zoned-dates';

describe('forms', () => {
  it('clears dirty state after the original value is restored', () => {
    expect(formIsDirty({ name: 'Ada' }, { name: 'Grace' })).toBe(true);
    expect(formIsDirty({ name: 'Ada' }, { name: 'Ada' })).toBe(false);
  });
  it('retains values edited during a save while adopting the saved identifier', () => {
    expect(reconcileSavedValues({ id: 0, name: 'Ada' }, { id: 0, name: 'Grace' }, { id: 7, name: 'Ada' }))
      .toEqual({ id: 7, name: 'Grace' });
  });
  it('rejects invalid inputs before sending a user command', () => {
    expect(validateContact({
      userName: 'ada', nameSurname: 'Ada Lovelace', birthDate: '1815-12-10', email: 'invalid',
      phone: '+90 555 012 3456', countryId: 1, cityId: 0, website: 'javascript:void(0)',
    }, 'required', 'invalid')).toEqual({ email: 'invalid', cityId: 'required', website: 'invalid' });
  });
});

describe('globalization', () => {
  it('uses owner-specific lookup, named arguments, and safe fallback', () => {
    expect(localize('en-US', 'Common.DeleteConfirm', { name: 'Ada' })).toBe('Delete Ada?');
    expect(localize('en-US', 'Save', undefined, 'Core')).toBe('Save');
    expect(localize('en-US', 'Save')).toBe('[UI:Save]');
    expect(localize('en-US', 'City', undefined, 'Core')).toBe(localize('tr-TR', 'City', undefined, 'Core'));
  });
  it('does not move a calendar date to the previous day in a negative time zone', () => {
    expect(createGlobalization('en-US', 'America/Los_Angeles').date('2000-01-01')).toContain('Jan 1, 2000');
  });
  it('preserves an unchanged membership instant and rejects ambiguous or missing local times', () => {
    const zone = 'Europe/Berlin';
    const saved = '2026-10-25T02:30:00.1234567+01:00';
    expect(localDateTimeInput(saved, zone)).toBe('2026-10-25T02:30');
    expect(localDateTimeInstant('2026-10-25T02:30', zone, saved)).toBe(saved);
    expect(localDateTimeInstant('2026-10-25T02:30', zone)).toBeUndefined();
    expect(localDateTimeInstant('2026-03-29T02:30', zone)).toBeUndefined();
    expect(localDateTimeInstant('2026-03-29T03:30', zone)).toBe('2026-03-29T01:30:00.000Z');
    expect(localDateInput(saved, zone)).toBe('2026-10-25');
    expect(localDateInstant('2026-10-25', zone, saved)).toBe(saved);
    expect(localDateInstant('2026-10-25', zone)).toBe('2026-10-24T22:00:00.000Z');
  });
});

describe('service boundaries', () => {
  it('permits internal redirects and caps the active deadline at the earlier server deadline', () => {
    expect(safeReturnPath('/userlistpage')).toBe('/userlistpage');
    for (const path of ['//external.test', 'https://external.test', '/%2Fexternal.test', '/login', '/fake']) {
      expect(safeReturnPath(path)).toBe('/index');
    }
    expect(sessionDeadline({ expireAtUtc: '2026-01-01T12:00:00Z', idleExpireAtUtc: '2026-01-01T11:00:00Z' }))
      .toBe(Date.parse('2026-01-01T11:00:00Z'));
  });
  it('refuses cross-origin API URLs and unsuccessful command envelopes', () => {
    expect(() => assertApiPath('//external.test/api/session')).toThrow();
    expect(() => confirmCommand({ success: false })).toThrow('command');
  });
});

describe('export files', () => {
  it('writes quoted CSV and neutralizes potential spreadsheet formulas', () => {
    expect(createCsv([['Full name', 'Value'], ['Özdemir, Ada', '=1+1']]))
      .toBe('\uFEFF"Full name","Value"\r\n"Özdemir, Ada","\'=1+1"');
  });
  it('writes an OpenXML workbook with typed numbers and escaped inline cell strings', () => {
    const workbook = unzipSync(createWorkbook([['ID', 'Name'], [7, 'Özdemir <Ada>']]));
    const sheet = strFromU8(workbook['xl/worksheets/sheet1.xml']);
    expect(sheet).toContain('<v>7</v>');
    expect(sheet).toContain('Özdemir &lt;Ada&gt;');
    expect(workbook['xl/workbook.xml']).toBeDefined();
  });
});
