import { z } from 'zod';
import { commandWithData, genericResponse, simpleData, type RecordStatus } from '@/shared/contracts';
import { ApiFailure, confirmCommand, withQuery, type HttpClientManager } from '@/shared/http';

const licenceRow = z.object({
  id: z.number().int().positive(), licenceName: z.string().nullish(), additionalPeriodAsDays: z.number().int(), isActive: z.boolean(),
});
export type LicenceRow = z.infer<typeof licenceRow>;

const customerLicenceRow = licenceRow.omit({ additionalPeriodAsDays: true }).extend({
  licenceTypeName: z.string().nullish(), startDate: z.string(), endDate: z.string().nullish(),
});
export type CustomerLicenceRow = z.infer<typeof customerLicenceRow>;
const audit = z.object({
  isDeleted: z.boolean(), insertedBy: z.number().int().nullish(), insertedDate: z.string().nullish(),
  updatedBy: z.number().int().nullish(), updatedDate: z.string().nullish(),
});
const licenceApplication = z.object({
  id: z.number().int(), applicationId: z.number().int(), applicationName: z.string().nullish(),
  isActive: z.boolean(), isDeleted: z.boolean(),
});
const licenceDetail = licenceRow.extend(audit.shape).extend({
  description: z.string().nullish(), licenceApplications: z.array(licenceApplication).nullish(),
});
export type LicenceRecord = z.infer<typeof licenceDetail>;
export type LicenceApplication = z.infer<typeof licenceApplication>;
const customerLicenceDetail = customerLicenceRow.omit({ licenceName: true, licenceTypeName: true }).extend(audit.shape).extend({
  customerId: z.number().int(), licenceTypeId: z.number().int(), licenceId: z.number().int(),
  maxUserCount: z.number().int(), additionalPeriodAsDays: z.number().int(), isTrial: z.boolean(), description: z.string().nullish(),
  startDateWithOffset: z.string().nullish(), endDateWithOffset: z.string().nullish(),
});
export type CustomerLicenceRecord = z.infer<typeof customerLicenceDetail>;
const customerLicenceChoices = z.object({ licences: z.array(simpleData), licenceTypes: z.array(simpleData) });
export type CustomerLicenceChoices = z.infer<typeof customerLicenceChoices>;

export function getLicences(http: HttpClientManager, status: RecordStatus, signal: AbortSignal) {
  return http.json('/api/customerservice/getlicences', z.array(licenceRow), {
    method: 'POST', modifying: false, body: { recordStatusQueryType: status }, signal,
  });
}

export function getCustomerLicences(http: HttpClientManager, customerId: number, status: RecordStatus, signal: AbortSignal) {
  return http.json('/api/customerservice/getcustomerlicences', z.array(customerLicenceRow), {
    method: 'POST', modifying: false, body: { customerId, recordStatusQueryType: status }, signal,
  });
}

export async function getLicence(http: HttpClientManager, licenceId: number, signal: AbortSignal) {
  const result = await http.json(withQuery('/api/customerservice/getlicence', { licenceId }), licenceDetail, { signal });
  if (!result.licenceApplications?.length) return result;
  const mappings = await http.json('/api/customerservice/getlicenceapplicationsssimple', z.array(z.object({
    licenceId: z.number().int(), applicationId: z.number().int(), applicationName: z.string().nullish(),
  })), { signal });
  const names = new Map(mappings.filter(mapping => mapping.licenceId === licenceId)
    .map(mapping => [mapping.applicationId, mapping.applicationName]));
  return { ...result, licenceApplications: result.licenceApplications.map(row =>
    ({ ...row, applicationName: row.applicationName || names.get(row.applicationId) })) };
}

export function getCustomerLicence(http: HttpClientManager, customerId: number, customerLicenceId: number, signal: AbortSignal) {
  return http.json(withQuery('/api/customerservice/getcustomerlicence', { customerId, customerLicenceId }),
    customerLicenceDetail, { signal });
}

export function getCustomerLicenceChoices(http: HttpClientManager, customerId: number, customerLicenceId: number, signal: AbortSignal) {
  return http.json(withQuery('/api/customerservice/getwebcustomerlicencechoices', { customerId, customerLicenceId }),
    customerLicenceChoices, { signal });
}

export async function saveCustomerLicence(http: HttpClientManager, customerId: number, value: CustomerLicenceRecord) {
  const { id, licenceId, licenceTypeId, maxUserCount, additionalPeriodAsDays, isTrial, description, isActive, isDeleted,
    startDateWithOffset, endDateWithOffset } = value;
  const result = confirmCommand(await http.json(withQuery('/api/customerservice/savecustomerlicence', { customerId }),
    commandWithData(z.number().int().positive()), { method: 'POST', body: {
      id, customerId, licenceId, licenceTypeId, maxUserCount, additionalPeriodAsDays, isTrial, description, isActive, isDeleted,
      useEditorDateOffsets: true, startDateWithOffset, endDateWithOffset,
    } }));
  if (!result.data) throw new ApiFailure('invalid-response');
  return result.data;
}

export async function deleteCustomerLicence(http: HttpClientManager, customerId: number, customerLicenceId: number) {
  confirmCommand(await http.json(withQuery('/api/customerservice/deletecustomerlicence', { customerId, customerLicenceId }),
    genericResponse, { method: 'POST' }));
}

export function getLicenceApplicationChoices(http: HttpClientManager, signal: AbortSignal) {
  return http.json('/api/customerservice/getweblicenceapplications', z.array(simpleData), { signal });
}

export async function saveLicence(http: HttpClientManager, licence: LicenceRecord, changes: LicenceApplication[]) {
  const { id, licenceName, additionalPeriodAsDays, description, isActive, isDeleted } = licence;
  const result = confirmCommand(await http.json('/api/customerservice/savelicence', commandWithData(z.number().int().positive()), {
    method: 'POST', body: { id, licenceName, additionalPeriodAsDays, description, isActive, isDeleted,
      licenceApplications: changes.map(row => ({
        id: row.id, licenceId: id, applicationId: row.applicationId, isActive: row.isActive, isDeleted: row.isDeleted,
      })) },
  }));
  if (!result.data) throw new ApiFailure('invalid-response');
  return result.data;
}

export async function deleteLicence(http: HttpClientManager, licenceId: number) {
  confirmCommand(await http.json(withQuery('/api/customerservice/deletelicence', { licenceId }),
    genericResponse, { method: 'POST' }));
}
