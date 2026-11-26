import { useState } from 'react';
import { useGlobalization } from '../globalization';
import { Button, controlClass, Field, Modal, SelectField } from './primitives';

export interface TreeItem { id: string; label: string; children?: TreeItem[] }

export function TreeView({ items, selected, onSelect }: { items: TreeItem[]; selected?: string; onSelect: (id: string) => void }) {
  return <ul className="grid gap-1">
    {items.map(item => <li key={item.id}>
      {item.children?.length ? <details>
        <summary className="cursor-pointer rounded px-2 py-1">{item.label}</summary>
        <div className="pl-4"><TreeView items={item.children} selected={selected} onSelect={onSelect} /></div>
      </details> : <Button variant="ghost" aria-pressed={item.id === selected} onClick={() => onSelect(item.id)}>{item.label}</Button>}
    </li>)}
  </ul>;
}
export function JsonTextEditor({ label, value, onChange, readOnly }: {
  label: string; value: string; onChange?: (value: string) => void; readOnly?: boolean;
}) {
  return <label className="grid gap-2 text-sm">{label}
    <textarea rows={12} className={controlClass + ' font-mono'} value={value} readOnly={readOnly}
      spellCheck={false} onChange={event => onChange?.(event.target.value)} />
  </label>;
}

export function InputPrompt({ label, title, options, onConfirm, onClose }: {
  label: string; title: string; options?: Array<{ value: string; label: string }>;
  onConfirm: (value: string) => void; onClose: () => void;
}) {
  const [value, setValue] = useState('');
  const { t } = useGlobalization();
  return <Modal title={title} onClose={onClose}>
    <form className="grid gap-4" onSubmit={event => { event.preventDefault(); if (value.trim()) onConfirm(value); }}>
      {options ? <SelectField label={label} value={value} options={[{ value: '', label: '–' }, ...options]} onChange={setValue} />
        : <Field label={label} value={value} onChange={setValue} />}
      <div className="flex justify-end gap-2">
        <Button onClick={onClose}>{t('Cancel', undefined, 'Core')}</Button>
        <Button variant="primary" type="submit" disabled={!value.trim()}>{t('Ok', undefined, 'Core')}</Button>
      </div>
    </form>
  </Modal>;
}
