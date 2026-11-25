import { z } from 'zod';
import { genericResponse, simpleData } from '@/shared/contracts';
import { confirmCommand, withQuery, type HttpClientManager } from '@/shared/http';

const text = z.string().nullish();
const int = z.number().int();

export const preferencesSchema = z.object({
  userId: int, photo: text, displayName: text, language: text, timeZone: text,
  twoFactorAuthentication: z.boolean(), saveAndCloseBehaviour: z.boolean(),
  sessionTimeoutAsSeconds: int, defaultApplicationId: int, defaultPageId: int,
  notifyBeforeSessionClosedAsSec: int, theme: z.string(), menuCollapsed: z.boolean(),
  menuPosition: z.union([z.literal(0), z.literal(1), z.enum(['Top', 'Left'])]).nullish()
    .transform(position => position === 'Top' ? 0 : position === 'Left' ? 1 : position),
  rowsPerPage: int, gridPagerPosition: z.string(),
});
export type WebUserPreferenceView = z.infer<typeof preferencesSchema>;

export const elementSchema = z.object({
  elementId: int, parentElementId: int, elementName: text, keyName: text,
  elementTypeKeyName: text, accessRight: int, listOrder: int, elementContent: text,
  isApplication: z.boolean(),
});
export type ApplicationElementView = z.infer<typeof elementSchema>;

const licence = z.object({
  licenceName: text, licenceTypeName: text, startDate: text, endDate: text,
  isTrial: z.boolean(), maxUserCount: int,
});
const licenceLink = z.object({ licenceId: int, customerId: int });
const applicationLink = z.object({ licenceId: int, applicationId: int, applicationName: text });
const contact = z.object({
  name: text, nameSurname: text, companyName: text, email: text, phone: text, website: text,
  address: text, address1: text, address2: text, supportMail: text, infoMail: text,
});

const path = '/api/userservice/';
export async function loadWorkspace(http: HttpClientManager, userId: number, customerId: number, signal: AbortSignal) {
  const [preferences, elements, customerLicences, mappings] = await Promise.all([
    http.json(withQuery(path + 'getuserpreferencesweb', { userId }), preferencesSchema, { signal }),
    http.json(path + 'getuseraccessibleelements', z.array(elementSchema), { signal }),
    http.json('/api/customerservice/getcustomerlicencessimple', z.array(licenceLink), { signal }),
    http.json('/api/customerservice/getlicenceapplicationsssimple', z.array(applicationLink), { signal }),
  ]);
  const ids = new Set(customerLicences.filter(entry => entry.customerId === customerId).map(entry => entry.licenceId));
  const eligible = new Map(mappings.filter(mapping => ids.has(mapping.licenceId)).map(mapping => [mapping.applicationId, mapping]));
  const applications = elements.filter(element => element.isApplication && eligible.has(element.elementId))
    .map(element => ({ id: element.elementId, name: element.elementName ?? eligible.get(element.elementId)?.applicationName,
      keyName: element.keyName }));
  return { preferences, elements, applications };
}

export function getPreferences(http: HttpClientManager, userId: number, signal: AbortSignal) {
  return http.json(withQuery(path + 'getuserpreferencesweb', { userId }), preferencesSchema, { signal });
}
export async function savePreferences(http: HttpClientManager, preferences: WebUserPreferenceView, photo?: File) {
  const body = new FormData();
  body.set('userPreferences', JSON.stringify(preferences));
  if (photo) body.set('photo', photo);
  confirmCommand(await http.json(path + 'saveuserpreferencesweb', genericResponse, { method: 'POST', body }));
}

export const loadLicence = (http: HttpClientManager, signal: AbortSignal) =>
  http.json('/api/customerservice/getcustomerlicenceinfo', licence.nullable(), { signal });
export const loadContact = (http: HttpClientManager, signal: AbortSignal) =>
  http.json('/api/customerservice/getownercustomer', contact.nullable(), { signal });
export const loadApplications = (http: HttpClientManager, signal: AbortSignal) =>
  http.json('/api/configuration/getapplicationconfigurationelements', z.array(simpleData), { signal });

export async function changePassword(http: HttpClientManager, oldPassword: string, newPassword: string) {
  confirmCommand(await http.json(path + 'changepassword', genericResponse, {
    method: 'POST', body: { oldPassword, newPassword },
  }));
}
