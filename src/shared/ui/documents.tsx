import { useCallback, useEffect, useRef, useState } from 'react';
import { Download, Files, Upload } from 'lucide-react';
import type { DocumentOperations, ObjectDocument } from '../document-operations';
import { downloadFile } from '../http';
import { useGlobalization } from '../globalization';
import { useResource } from '../resource';
import { Button, Modal, WorkspaceIcon } from './primitives';
import { PagedDataTable } from './data-table';
import { StatusPanel } from './page';
import { useDialogManager } from './dialog-manager';
import { useTableExport } from './table-export-action';
import { toast } from './toasts';
import { Toolbar } from './toolbar';

type DocumentPermissions = { view: boolean; upload: boolean; delete: boolean };
type PreviewKind = 'image' | 'pdf' | 'text';
type PreviewFile = { blob: Blob; name: string; kind: PreviewKind };

function previewKind(mime: string, name: string): PreviewKind | undefined {
  if (['image/jpeg', 'image/png', 'image/gif'].includes(mime)) return 'image';
  if (mime === 'application/pdf') return 'pdf';
  // The scoped browser download serves text attachments as octet-stream.
  if (mime === 'text/plain' || (mime === 'application/octet-stream' && /\.txt$/i.test(name))) return 'text';
}

export function DocumentsToolbarButton({ allow, disabled, onOpen }: {
  allow: DocumentPermissions; disabled?: boolean; onOpen: () => void;
}) {
  const { t } = useGlobalization();
  if (!allow.view && !allow.upload && !allow.delete) return null;
  return <Button variant="ghost" className="workspace-toolbar-button" disabled={disabled} onClick={onOpen}>
    <Files />{t('Common.Documents')}
  </Button>;
}

export function ObjectDocuments({ operations, allow, onClose, onChanged }: {
  operations: DocumentOperations; allow: DocumentPermissions; onClose: () => void; onChanged?: () => void;
}) {
  const { t, error } = useGlobalization();
  const dialog = useDialogManager();
  const [pending, setPending] = useState(false);
  const [preview, setPreview] = useState<PreviewFile>();
  const [uploadResults, setUploadResults] = useState<{ name: string; message: string }[]>([]);
  const commandInFlight = useRef<AbortController | null>(null);
  useEffect(() => () => commandInFlight.current?.abort(), []);
  const canList = allow.view || allow.delete;
  const load = useCallback(async (signal: AbortSignal) => {
    if (!canList) return [];
    const rows = await operations.list(signal);
    return rows.filter(row => !row.isDeleted);
  }, [operations, canList]);
  const result = useResource(load);
  function changed() {
    result.refresh();
    onChanged?.();
  }
  async function command(action: (signal: AbortSignal) => Promise<void>, changes = false) {
    if (commandInFlight.current) return;
    const controller = new AbortController();
    commandInFlight.current = controller;
    setPending(true);
    try { await action(controller.signal); }
    catch (failure) { if (!controller.signal.aborted) toast.error(error(failure, changes)); }
    finally {
      commandInFlight.current = null;
      if (!controller.signal.aborted) setPending(false);
    }
  }
  function download(row: ObjectDocument, previewOnly: boolean) {
    if (!allow.view || result.state !== 'ready') return;
    void command(async signal => {
      const file = await operations.download(row.documentId, signal);
      if (signal.aborted) return;
      const name = file.name ?? row.documentName;
      if (!previewOnly) {
        downloadFile(file.blob, name);
        return;
      }
      const kind = previewKind(file.mime, name);
      if (kind) setPreview({ blob: file.blob, name, kind });
      else toast.info(t('Common.Unavailable'));
    });
  }
  function remove(row: ObjectDocument) {
    if (!allow.delete) return;
    void command(async signal => {
      if (!await dialog({ message: t('Common.DeleteConfirm', { name: row.documentName }),
        accept: t('Delete', undefined, 'Core'), reject: t('Cancel', undefined, 'Core') }) || signal.aborted) return;
      await operations.remove(row.documentId, signal);
      if (signal.aborted) return;
      toast.success(t('Common.Deleted'));
      changed();
    }, true);
  }
  function upload(files: File[]) {
    if (!allow.upload || files.length === 0) return;
    void command(async signal => {
      setUploadResults([]);
      let uploaded = false;
      for (const file of files) {
        if (signal.aborted) return;
        const allowedExtension = operations.extensions.some(extension => file.name.toLowerCase().endsWith(extension));
        let message = t('Common.FileInvalid');
        if (allowedExtension && file.size > 0 && file.size <= operations.maxUploadBytes) {
          try {
            await operations.upload(file, signal);
            uploaded = true;
            message = t('Common.Saved');
          } catch (failure) { message = error(failure, true); }
        }
        if (signal.aborted) return;
        setUploadResults(results => [...results, { name: file.name, message }]);
      }
      if (uploaded) changed();
    }, true);
  }
  const core = (key: string) => t(key, undefined, 'Core');
  const metadataColumns = [
    { key: 'id', title: core('Id'), render: (row: ObjectDocument) => row.documentId },
    { key: 'name', title: core('Name'), render: (row: ObjectDocument) => row.documentName },
    { key: 'fileType', title: core('FileType'), render: (row: ObjectDocument) => row.documentFileTypeName ?? '' },
    { key: 'type', title: core('Type'), render: (row: ObjectDocument) => row.documentTypeName ?? '' },
    { key: 'description', title: core('Description'), render: (row: ObjectDocument) => row.description ?? '' },
  ];
  const exportMetadata = useTableExport('documents', metadataColumns);
  const rows = result.state === 'ready' ? result.data : [];
  return <Modal title={t('Common.Documents')} onClose={() => { if (!commandInFlight.current) onClose(); }}>
    {canList && <Toolbar operation="ObjectDocuments" actions={[
      { key: 'refresh', label: core('Refresh'), icon: <WorkspaceIcon name="refresh" />,
        enabled: !pending && result.state !== 'loading', run: result.refresh },
      { ...exportMetadata(rows, !pending), allowed: allow.view },
    ]} />}
    {allow.upload && <label className="flex min-w-0 flex-wrap items-center gap-2 text-sm"><Upload size={16} />{t('Common.Upload')}
      <input type="file" className="min-w-0 max-w-full" disabled={pending} accept={operations.extensions.join(',')} multiple
        onChange={event => { const files = Array.from(event.target.files ?? []); event.target.value = ''; upload(files); }} />
    </label>}
    <ul aria-live="polite" className="break-all text-sm">
      {uploadResults.map(({ name, message }, index) => <li key={index}><b>{name}</b> · {message}</li>)}
    </ul>
    {canList && result.state === 'loading' && <StatusPanel kind="loading" />}
    {result.state === 'error' && <StatusPanel kind="error" error={result.error} retry={result.refresh} />}
    {canList && result.state === 'ready' &&
      <PagedDataTable label={t('Common.Documents')} rows={rows} rowId={row => row.documentId} columns={[
        ...metadataColumns,
        { key: 'actions', title: t('Common.Actions'), render: row => <div className="flex flex-wrap gap-1">
          {allow.view && <>
            <Button disabled={pending} onClick={() => download(row, true)} aria-label={t('Common.Preview')}><WorkspaceIcon name="view" /></Button>
            <Button disabled={pending} onClick={() => download(row, false)} aria-label={t('Common.Download')}><Download /></Button>
          </>}
          {allow.delete && <Button disabled={pending} onClick={() => remove(row)} variant="destructive"
            aria-label={t('Delete', undefined, 'Core')}><WorkspaceIcon name="delete" /></Button>}
        </div> },
      ]} />}
    {preview && <DocumentPreview file={preview} close={() => setPreview(undefined)} />}
  </Modal>;
}

function DocumentPreview({ file, close }: { file: PreviewFile; close: () => void }) {
  const { t } = useGlobalization();
  const load = useCallback(async (signal: AbortSignal) => {
    if (file.kind === 'pdf') return undefined;
    const reader = new FileReader();
    return new Promise<string>((resolve, reject) => {
      signal.addEventListener('abort', () => reader.abort(), { once: true });
      reader.onerror = reject;
      reader.onload = () => resolve(String(reader.result));
      if (file.kind === 'text') reader.readAsText(file.blob);
      else reader.readAsDataURL(file.blob);
    });
  }, [file]);
  const result = useResource(load);
  return <Modal title={file.name} onClose={close}>
    {result.state === 'ready' && file.kind === 'image' && <img src={result.data} alt={file.name} className="max-h-[60dvh] max-w-full object-contain" />}
    {result.state === 'ready' && file.kind === 'text' && <pre className="m-0 whitespace-pre-wrap [overflow-wrap:anywhere]">{result.data}</pre>}
    {file.kind === 'pdf' && <Button onClick={() => downloadFile(file.blob, file.name)}>{t('Common.Download')}</Button>}
    {result.state === 'loading' && <StatusPanel kind="loading" />}
    {result.state === 'error' && <StatusPanel kind="error" error={result.error} retry={result.refresh} />}
  </Modal>;
}
