import { z } from 'zod';
import { genericResponse, simpleData, type RecordStatus } from '@/shared/contracts';
import { confirmCommand, withQuery, type HttpClientManager } from '@/shared/http';

const customerRow = z.object({
  id: z.number().int().positive(), customerName: z.string().nullish(), customerTypeName: z.string().nullish(),
  infoEmail: z.string().nullish(), phone: z.string().nullish(),
});
export type CustomerRow = z.infer<typeof customerRow>;

const text = z.string().nullish();
const number = z.number().int();
const customerDetail = customerRow.omit({ customerTypeName: true }).extend({
  keyName: text, customerTypeId: number, description: text, supportEmail: text, phone2: text, website: text,
  countryId: number, countryRegionId: number, cityId: number, language: text, timeZone: text,
  isActive: z.boolean(), isDeleted: z.boolean(), insertedBy: number.nullish(), insertedDate: text,
  updatedBy: number.nullish(), updatedDate: text,
});
export type CustomerDetail = z.infer<typeof customerDetail>;

export function getCustomers(http: HttpClientManager, status: RecordStatus, customerType: number, signal: AbortSignal) {
  return http.json('/api/customerservice/getcustomers', z.array(customerRow),
    { method: 'POST', modifying: false, body: { recordStatusQueryType: status, customerType }, signal });
}

export function getCustomerTypes(http: HttpClientManager, signal: AbortSignal) {
  return http.json('/api/customerservice/getcustomertypessimple', z.array(simpleData), { signal });
}

export function getCustomer(http: HttpClientManager, customerId: number, signal: AbortSignal) {
  return http.json(withQuery('/api/customerservice/getcustomer', { customerId }), customerDetail, { signal });
}

export async function saveCustomer(http: HttpClientManager, values: CustomerDetail) {
  const { id, customerName, keyName, customerTypeId, description, infoEmail, supportEmail, phone, phone2,
    website, countryId, countryRegionId, cityId, language, timeZone, isActive, isDeleted } = values;
  confirmCommand(await http.json('/api/customerservice/savecustomer', genericResponse, {
    method: 'POST', body: { id, customerName, keyName, customerTypeId, description, infoEmail, supportEmail, phone,
      phone2, website, countryId, countryRegionId, cityId, language, timeZone, isActive, isDeleted },
  }));
}

export async function deleteCustomer(http: HttpClientManager, customerId: number) {
  confirmCommand(await http.json(withQuery('/api/customerservice/deletecustomer', { customerId }), genericResponse,
    { method: 'POST' }));
}
