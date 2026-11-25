import { useCallback, useRef, useState } from 'react';
import { Download, Eye, Trash2, Upload } from 'lucide-react';
import { z } from 'zod';
import { genericResponse } from '../contracts';
import { confirmCommand, downloadFile, withQuery, type HttpClientManager } from '../http';
import { useGlobalization } from '../globalization';
import { useResource } from '../resource';
import { Button, Modal } from './primitives';
import { DataTable } from './data-table';
import { StatusPanel } from './page';
import { useDialogManager } from './dialog-manager';
import { toast } from './toasts';

const documentSchema = z.object({
  documentId: z.union([z.number().int().safe().positive(), z.string().regex(/^\d+$/)]),
  documentName: z.string(), isDeleted: z.boolean(), documentFileTypeName: z.string().nullish(),
});
type DocumentRow = z.infer<typeof documentSchema>;
const prefix = '/api/document/';

export function ObjectDocuments({ http, userId, allow, onClose }: {
  http: HttpClientManager; userId: number;
  allow: { view: boolean; upload: boolean; delete: boolean }; onClose: () => void;
}) {
  const { t, error } = useGlobalization();
  const dialog = useDialogManager();
  const [pending, setPending] = useState(false);
  const [preview, setPreview] = useState<{ blob: Blob; name: string }>();
  const busy = useRef(false);
  const load = useCallback(async (signal: AbortSignal) => {
    if (!allow.view && !allow.delete) return [];
    const rows = await http.json(withQuery(prefix + 'getobjectdocuments', { userId }), z.array(documentSchema), { signal });
    return rows.filter(row => !row.isDeleted);
  }, [http, userId, allow.view, allow.delete]);
  const result = useResource(load);
  async function command(action: () => Promise<void>, changes = false) {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    try { await action(); }
    catch (failure) { toast.error(error(failure, changes)); }
    finally { busy.current = false; setPending(false); }
  }
  function download(row: DocumentRow, previewOnly: boolean) {
    if (!allow.view || result.state !== 'ready') return;
    void command(async () => {
      const file = await http.file(withQuery(prefix + 'downloadobjectdocument', {
        userId, documentObjectId: row.documentId,
      }));
      const name = file.name ?? row.documentName;
      if (previewOnly && ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'].includes(file.mime)) {
        setPreview({ blob: file.blob, name });
      } else if (previewOnly) toast.info(t('Common.Unavailable'));
      else downloadFile(file.blob, name);
    });
  }
  function remove(row: DocumentRow) {
    if (!allow.delete) return;
    void command(async () => {
      if (!await dialog({ message: t('Common.DeleteConfirm', { name: row.documentName }),
        accept: t('Delete', undefined, 'Core'), reject: t('Cancel', undefined, 'Core') })) return;
      confirmCommand(await http.json(withQuery(prefix + 'deleteobjectdocument', {
        userId, documentObjectId: row.documentId,
      }), genericResponse, { method: 'POST' }));
      toast.success(t('Common.Deleted'));
      result.refresh();
    }, true);
  }
  function upload(file: File) {
    if (!allow.upload || result.state !== 'ready') return;
    if (file.size <= 0 || file.size > 10 * 1024 * 1024 || !/\.(pdf|png|jpe?g|gif|txt|docx|xlsx)$/i.test(file.name)) {
      toast.warning(t('Common.FileInvalid'));
      return;
    }
    void command(async () => {
      const body = new FormData();
      body.append('userId', String(userId));
      body.append('file', file);
      confirmCommand(await http.json(prefix + 'uploadobjectdocuments', genericResponse, { method: 'POST', body }));
      toast.success(t('Common.Saved'));
      result.refresh();
    }, true);
  }
  return <Modal title={t('Common.Documents')} onClose={() => { if (!busy.current) onClose(); }}>
    {result.state === 'loading' && <StatusPanel kind="loading" />}
    {result.state === 'error' && <StatusPanel kind="error" error={result.error} retry={result.refresh} />}
    {result.state === 'ready' && <>
      {allow.upload && <label className="mb-4 flex flex-wrap items-center gap-2 text-sm"><Upload size={16} />{t('Common.Upload')}
        <input type="file" className="min-w-0 max-w-full" disabled={pending} accept=".pdf,.png,.jpg,.jpeg,.gif,.txt,.docx,.xlsx"
          onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (file) upload(file); }} />
      </label>}
      {(allow.view || allow.delete) && <DataTable label={t('Common.Documents')} rows={result.data} rowId={row => row.documentId} columns={[
        { key: 'name', title: t('Field.Name'), render: row => row.documentName },
        { key: 'actions', title: t('Common.Actions'), render: row => <div className="flex flex-wrap gap-1">
          {allow.view && <>
            <Button disabled={pending} onClick={() => download(row, true)} aria-label={t('Common.Preview')}><Eye /></Button>
            <Button disabled={pending} onClick={() => download(row, false)} aria-label={t('Common.Download')}><Download /></Button>
          </>}
          {allow.delete && <Button disabled={pending} onClick={() => remove(row)} variant="destructive"
            aria-label={t('Delete', undefined, 'Core')}><Trash2 /></Button>}
        </div> },
      ]} />}
    </>}
    {preview && <DocumentPreview file={preview} close={() => setPreview(undefined)} />}
  </Modal>;
}

function DocumentPreview({ file, close }: { file: { blob: Blob; name: string }; close: () => void }) {
  const { t } = useGlobalization();
  const load = useCallback(async (signal: AbortSignal) => {
    if (file.blob.type === 'application/pdf') return undefined;
    const reader = new FileReader();
    return new Promise<string>((resolve, reject) => {
      signal.addEventListener('abort', () => reader.abort(), { once: true });
      reader.onerror = reject;
      reader.onload = () => resolve(String(reader.result));
      reader.readAsDataURL(file.blob);
    });
  }, [file]);
  const result = useResource(load);
  return <Modal title={file.name} onClose={close}>
    {result.state === 'ready' && result.data && <img src={result.data} alt={file.name} className="max-h-[60dvh] max-w-full object-contain" />}
    {file.blob.type === 'application/pdf' && <Button onClick={() => downloadFile(file.blob, file.name)}>{t('Common.Download')}</Button>}
    {result.state === 'loading' && <StatusPanel kind="loading" />}
    {result.state === 'error' && <StatusPanel kind="error" error={result.error} retry={result.refresh} />}
  </Modal>;
}
