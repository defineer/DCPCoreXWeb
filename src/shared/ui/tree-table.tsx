import { useState, type CSSProperties } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { PagedDataTable, type Column } from './data-table';
import { Button } from './primitives';

interface TreeRow<T> { value: T; depth: number; hasChildren: boolean }

function visibleRows<T>(rows: T[], rowId: (row: T) => number, parentId: (row: T) => number, expanded: Set<number>) {
  const ids = new Set(rows.map(rowId));
  const children = new Map<number, T[]>();
  for (const row of rows) {
    const parent = ids.has(parentId(row)) ? parentId(row) : 0;
    const siblings = children.get(parent) ?? [];
    siblings.push(row);
    children.set(parent, siblings);
  }

  const visible: TreeRow<T>[] = [];
  const visited = new Set<number>();
  const pending = (children.get(0) ?? []).map(value => ({ value, depth: 0 })).reverse();
  while (pending.length) {
    const current = pending.pop();
    if (!current) break;
    const id = rowId(current.value);
    if (visited.has(id)) continue;
    visited.add(id);
    const descendants = children.get(id) ?? [];
    visible.push({ ...current, hasChildren: descendants.length > 0 });
    if (expanded.has(id)) {
      for (let index = descendants.length - 1; index >= 0; index--) {
        pending.push({ value: descendants[index], depth: current.depth + 1 });
      }
    }
  }
  return visible;
}

export function TreeTable<T>({ label, rows, columns, rowId, parentId, nameColumn, selected, onSelect, onPageChange }: {
  label: string; rows: T[]; columns: Column<T>[]; rowId: (row: T) => number; parentId: (row: T) => number;
  nameColumn: string; selected?: number; onSelect?: (row: T) => void; onPageChange?: () => void;
}) {
  const [expanded, setExpanded] = useState(new Set<number>());
  const treeColumns: Column<TreeRow<T>>[] = columns.map(column => ({
    ...column,
    render: ({ value, depth, hasChildren }) => {
      const content = column.render(value);
      if (column.key !== nameColumn) return content;
      const id = rowId(value);
      const open = expanded.has(id);
      return <div className="workspace-tree-cell" style={{ '--tree-depth': depth } as CSSProperties}>
        {hasChildren && <Button variant="ghost" className="workspace-tree-toggle" aria-expanded={open}
          aria-label={String(content)} onClick={() => setExpanded(current => {
            const next = new Set(current);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
          })}>{open ? <ChevronDown aria-hidden /> : <ChevronRight aria-hidden />}</Button>}
        <span>{content}</span>
      </div>;
    },
  }));

  return <PagedDataTable pagerPosition="Top" onPageChange={onPageChange} label={label} columns={treeColumns} rows={visibleRows(rows, rowId, parentId, expanded)}
    rowId={row => rowId(row.value)} selected={selected} onSelect={onSelect && (row => onSelect(row.value))} resizable />;
}
