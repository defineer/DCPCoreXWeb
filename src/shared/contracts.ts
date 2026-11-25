import { z } from 'zod';

export const genericResponse = z.object({
  success: z.boolean(), message: z.string().nullish(),
});
export const commandWithData = <T extends z.ZodType>(data: T) =>
  genericResponse.extend({ data: data.nullish() });

export const pagedResponse = <T extends z.ZodType>(row: T) =>
  z.object({ data: z.array(row), totalRecords: z.number().int().nonnegative() });

export interface PagedDataFilter {
  page: number;
  pageSize: number;
  sortColumn?: string;
  isDescending?: boolean;
}

export const simpleData = z.object({ id: z.number().int(), name: z.string().nullish() });
export const keyedData = simpleData.extend({ keyName: z.string().nullish() });
export type SimpleDataView = z.infer<typeof simpleData>;
export interface SimpleDataLongTypeView { id: string | number; name?: string | null }

export const deadlineFields = z.object({
  expireAtUtc: z.iso.datetime({ offset: true }),
  idleExpireAtUtc: z.iso.datetime({ offset: true }),
});
export const sessionView = deadlineFields.extend({
  userId: z.number().int().positive(), customerId: z.number().int().nonnegative(),
  userName: z.string(), displayName: z.string().nullish(), language: z.string(),
  timeZone: z.string(), isLimitedSession: z.boolean(), csrfToken: z.string().min(1),
});
export type SessionView = z.infer<typeof sessionView>;
export const browserChallengeView = z.object({
  csrfToken: z.string().min(1), expiresAtUtc: z.iso.datetime({ offset: true }),
});
export const logoutView = z.object({ localClosed: z.boolean(), revocationStatus: z.union([z.string(), z.number()]) });

export const exceptionResponse = z.object({
  challenge: browserChallengeView.optional(),
  code: z.string().optional(), errorCode: z.union([z.string(), z.number()]).optional(),
  message: z.string().optional(), correlationId: z.string().optional(),
  userFriendlyMessage: z.string().optional(), receiveTimeAsSeconds: z.number().positive().optional(),
  errors: z.record(z.string(), z.union([z.string(), z.array(z.string())])).optional(),
});
