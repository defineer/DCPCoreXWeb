import { z } from 'zod';

export const membershipFields = z.object({
  id: z.number().int().positive(),
  isPrimary: z.boolean(),
  startDate: z.string(),
  endDate: z.string().nullish(),
  isActive: z.boolean(),
});
export const userMembership = membershipFields.extend({ userName: z.string().nullish() });
export type Membership = z.infer<typeof membershipFields>;
export type UserMembership = z.infer<typeof userMembership>;
