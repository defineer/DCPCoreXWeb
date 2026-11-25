import { ArrowDown, ArrowUp, ChevronFirst, ChevronLast, ChevronLeft, ChevronRight, SearchX } from 'lucide-react';
import { useRef, useState, type ReactNode } from 'react';
import { useGlobalization } from '../globalization';
import { Button } from './primitives';
import { PageGroup } from './page';

export interface Column<T> {
  key: string; title: string; render: (row: T) => ReactNode; sortable?: boolean; width?: string; numeric?: boolean;
}
export interface Sort { key: string; descending: boolean }

function columnWidths(handle: HTMLElement) {
  return Array.from(handle.closest('tr')?.cells ?? [], cell => cell.getBoundingClientRect().width);
}

export function DataTable<T>({ rows, columns, label, rowId, selected, onSelect, sort, onSort, resizable }: {
  rows: T[]; columns: Column<T>[]; label: string; rowId: (row: T) => string | number;
  selected?: string | number; onSelect?: (row: T) => void;
  sort?: Sort; onSort?: (sort: Sort) => void; resizable?: boolean;
}) {
  const { t } = useGlobalization();
  const columnKeys = JSON.stringify(columns.map(column => column.key));
  const [size, setSize] = useState<{ keys: string; widths: number[] }>();
  const drag = useRef<{ pointer: number; x: number; widths: number[] }>(null);
  const widths = size?.keys === columnKeys ? size.widths : undefined;
  function resize(index: number, current: number[], offset: number) {
    const total = current.reduce((sum, width) => sum + width, 0);
    const pairWidth = current[index] + current[index + 1];
    if (!total || !pairWidth) return;
    const minimum = Math.min(64, pairWidth / 3);
    const next = Math.min(pairWidth - minimum, Math.max(minimum, current[index] + offset));
    const updated = [...current];
    updated[index] = next;
    updated[index + 1] = pairWidth - next;
    setSize({ keys: columnKeys, widths: updated.map(width => width / total * 100) });
  }
  return <div className="workspace-table" role="region" aria-label={label} tabIndex={resizable ? 0 : undefined}
    data-resizable={resizable || undefined}>
    <table aria-label={label}>
      {resizable && <colgroup>{columns.map((column, index) => <col key={column.key}
        style={{ width: widths ? `${widths[index]}%` : column.width }} />)}</colgroup>}
      <thead>
        <tr>{columns.map((column, index) => <th key={column.key} scope="col"
          aria-label={resizable ? column.title : undefined}
          style={resizable ? undefined : { width: column.width }}
          aria-sort={sort?.key === column.key ? sort.descending ? 'descending' : 'ascending' : undefined}>
          {column.sortable && onSort
            ? <button type="button" className="inline-flex items-center gap-1.5 rounded text-left"
              onClick={() => onSort({ key: column.key, descending: sort?.key === column.key ? !sort.descending : false })}>
              {column.title}{sort?.key === column.key && (sort.descending ? <ArrowDown size={14} /> : <ArrowUp size={14} />)}
            </button> : column.title}
          {resizable && index < columns.length - 1 && <span role="separator" tabIndex={0} className="workspace-column-resize"
            aria-orientation="vertical" aria-valuemin={0} aria-valuemax={100}
            aria-valuenow={Math.round(widths?.[index] ?? (column.width?.endsWith('%') ? Number.parseFloat(column.width) : 100 / columns.length))}
            aria-label={t('Common.ResizeColumn', { column: column.title })}
            onPointerDown={event => {
              if (event.button !== 0 || drag.current) return;
              event.currentTarget.setPointerCapture(event.pointerId);
              drag.current = { pointer: event.pointerId, x: event.clientX, widths: columnWidths(event.currentTarget) };
            }} onPointerMove={event => {
              const active = drag.current;
              if (active?.pointer === event.pointerId) resize(index, active.widths, event.clientX - active.x);
            }} onLostPointerCapture={event => {
              if (drag.current?.pointer === event.pointerId) drag.current = null;
            }} onKeyDown={event => {
              if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
              event.preventDefault();
              resize(index, columnWidths(event.currentTarget), event.key === 'ArrowRight' ? 16 : -16);
            }} />}
        </th>)}</tr>
      </thead>
      <tbody>
        {rows.map(row => {
          const id = rowId(row);
          return <tr key={id} data-state={id === selected ? 'selected' : undefined}
            onClick={onSelect ? event => {
              if (!(event.target instanceof Element) || !event.target.closest('button,a,input')) onSelect(row);
            } : undefined}>
            {columns.map((column, i) => <td key={column.key} className={column.numeric ? 'text-right tabular-nums' : undefined}>
              {i === 0 && onSelect
                ? <button type="button" aria-pressed={id === selected} onClick={() => onSelect(row)}
                  className="rounded font-medium">{column.render(row)}</button>
                : column.render(row)}
            </td>)}
          </tr>;
        })}
        {!rows.length && <tr><td colSpan={columns.length} className="workspace-empty-row">
          <SearchX aria-hidden className="mx-auto mb-2 size-9" />{t('Common.Empty')}
        </td></tr>}
      </tbody>
    </table>
  </div>;
}

export function Pagination({ page, pageSize, total, onPage, direct }: {
  page: number; pageSize: number; total: number; onPage: (page: number) => void; direct?: boolean;
}) {
  const { t, number } = useGlobalization();
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages === 1) return null;
  return <div className="workspace-pager">
    <p className="text-sm text-muted-foreground">{t('Common.Page', {
      page: number.format(page), pages: number.format(pages), total: number.format(total),
    })}</p>
    <div className="flex items-center gap-1">
      {direct && <Button aria-label={t('Common.FirstPage')} disabled={page <= 1} onClick={() => onPage(1)}><ChevronFirst /></Button>}
      <Button aria-label={t('Common.Previous')} disabled={page <= 1} onClick={() => onPage(page - 1)}><ChevronLeft /></Button>
      {direct && <form className="flex items-center gap-2 text-sm" onSubmit={event => {
        event.preventDefault();
        const next = Number(new FormData(event.currentTarget).get('page'));
        if (Number.isInteger(next) && next >= 1 && next <= pages && next !== page) onPage(next);
      }}>
        <input key={page} name="page" type="number" min={1} max={pages} required defaultValue={page}
          aria-label={t('Common.PageNumber')} />
        <span>{t('Common.PageOf', { pages: number.format(pages) })}</span>
      </form>}
      <Button aria-label={t('Common.Next')} disabled={page >= pages} onClick={() => onPage(page + 1)}><ChevronRight /></Button>
      {direct && <Button aria-label={t('Common.LastPage')} disabled={page >= pages} onClick={() => onPage(pages)}><ChevronLast /></Button>}
    </div>
  </div>;
}

export function ListPage({ tools, query, resultsTitle, split, children }: {
  tools?: ReactNode; query: ReactNode; resultsTitle: string; split?: boolean; children: ReactNode;
}) {
  const { t } = useGlobalization();
  return <>
    {tools}
    <div className={split ? 'workspace-list-split' : 'grid gap-2'}>
      <PageGroup title={t('Query', undefined, 'Core')}>{query}</PageGroup>
      <PageGroup title={resultsTitle}>{children}</PageGroup>
    </div>
  </>;
}
