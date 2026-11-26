import { z } from 'zod';
import { commandWithData, genericResponse, pagedResponse, type PagedDataFilter, type RecordStatus } from '@/shared/contracts';
import { ApiFailure, confirmCommand, withQuery, type HttpClientManager } from '@/shared/http';
import { contactSchema, type ContactValues } from '@/shared/contact-fields';
import { objectDocument, type DocumentOperations } from '@/shared/document-operations';

const prefix = '/api/userservice/';

export function userDocumentOperations(http: HttpClientManager, userId: number): DocumentOperations {
  const base = '/api/document/';
  return {
    maxUploadBytes: 10 * 1024 * 1024,
    extensions: ['.pdf', '.png', '.jpg', '.jpeg', '.gif', '.txt', '.docx', '.xlsx'],
    list: signal => http.json(withQuery(base + 'getobjectdocuments', { userId }), z.array(objectDocument), {
      signal, exactIntegerFields: ['documentId'],
    }),
    download: (documentObjectId, signal) => http.file(
      withQuery(base + 'downloadobjectdocument', { userId, documentObjectId }), { signal }),
    async upload(file, signal) {
      const body = new FormData();
      body.append('userId', String(userId));
      body.append('file', file);
      confirmCommand(await http.json(base + 'uploadobjectdocuments', genericResponse, { method: 'POST', body, signal }));
    },
    async remove(documentObjectId, signal) {
      confirmCommand(await http.json(withQuery(base + 'deleteobjectdocument', { userId, documentObjectId }),
        genericResponse, { method: 'POST', signal }));
    },
  };
}
const listRow = z.object({
  id: z.number().int().positive(), userName: z.string().nullish(), nameSurname: z.string().nullish(),
  email: z.string().nullish(), isActive: z.boolean(),
});
export type UserListView = z.infer<typeof listRow>;
export interface UserListQueryView { recordStatusQueryType: RecordStatus; dataFilter: PagedDataFilter }

export const userEditSchema = contactSchema.extend({
  isBlocked: z.boolean(), isSingleUsablePassword: z.boolean(),
  isActive: z.boolean(), isDeleted: z.boolean(), defaultDataFilterScopeId: z.number().int().nullish(),
  insertedDate: z.string().nullish(), insertedBy: z.number().int().nullish(),
  updatedDate: z.string().nullish(), updatedBy: z.number().int().nullish(),
});
export type UserEditView = z.infer<typeof userEditSchema>;

export function emptyUser(): UserEditView {
  return {
    id: 0, userName: '', nameSurname: '', email: '', email2: '', phone: '', phone2: '',
    gender: 0, birthDate: '', countryId: 0, countryRegionId: 0, cityId: 0,
    website: '', description: '', isActive: true, isDeleted: false, isBlocked: false, isSingleUsablePassword: false,
  };
}

export function getUsers(http: HttpClientManager, body: UserListQueryView, signal: AbortSignal) {
  return http.json(prefix + 'getuserspaged', pagedResponse(listRow), { method: 'POST', modifying: false, body, signal });
}

export function getUser(http: HttpClientManager, userId: number, signal: AbortSignal) {
  return http.json(withQuery(prefix + 'getuser', { userId }), userEditSchema, { signal });
}

export async function saveUser(http: HttpClientManager, value: UserEditView & ContactValues) {
  const body = { ...value };
  delete body.insertedBy;
  delete body.insertedDate;
  delete body.updatedBy;
  delete body.updatedDate;
  delete body.lastPasswordChangedDate;
  const response = confirmCommand(await http.json(prefix + 'saveuser',
    commandWithData(z.number().int().positive()), { method: 'POST', body }));
  if (!response.data) throw new ApiFailure('invalid-response');
  return response.data;
}

export async function deleteUser(http: HttpClientManager, userId: number) {
  confirmCommand(await http.json(withQuery(prefix + 'deleteuser', { userId }), genericResponse, { method: 'POST' }));
}
