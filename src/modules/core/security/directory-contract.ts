import { z } from 'zod';

export const directoryDetail = z.object({
  id: z.number().int().positive(), keyName: z.string().nullish(), description: z.string().nullish(),
  isActive: z.boolean(), isDeleted: z.boolean(),
  insertedBy: z.number().int().nullish(), insertedDate: z.string().nullish(),
  updatedBy: z.number().int().nullish(), updatedDate: z.string().nullish(),
});
export type DirectoryDetail = z.infer<typeof directoryDetail> & {
  name?: string | null;
  parent?: { id?: number | null; name?: string | null };
};
