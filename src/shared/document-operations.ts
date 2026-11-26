import { z } from 'zod';

export const objectDocument = z.object({
  documentId: z.string().regex(/^[1-9][0-9]*$/),
  documentName: z.string(),
  documentFileTypeName: z.string().nullish(),
  documentTypeName: z.string().nullish(),
  description: z.string().nullish(),
  isDeleted: z.boolean(),
});
export type ObjectDocument = z.infer<typeof objectDocument>;

export interface DocumentOperations {
  maxUploadBytes: number;
  extensions: readonly string[];
  list(signal: AbortSignal): Promise<ObjectDocument[]>;
  download(id: string, signal: AbortSignal): Promise<{ blob: Blob; name?: string; mime: string }>;
  upload(file: File, signal: AbortSignal): Promise<void>;
  remove(id: string, signal: AbortSignal): Promise<void>;
}
