import { exportTable, type ExportCell } from '../export';
import { useGlobalization } from '../globalization';
import { WorkspaceIcon } from './primitives';
import type { ToolbarAction } from './toolbar';
import { toast } from './toasts';

export function useTableExport<T>(filename: string, columns: readonly { title: string; render: (row: T) => ExportCell }[]) {
  const { t, error } = useGlobalization();
  return (rows: T[], enabled = true): ToolbarAction => ({
    key: 'export',
    label: t('Export', undefined, 'Core'),
    icon: <WorkspaceIcon name="export" />,
    enabled: enabled && rows.length > 0,
    actions: (['xlsx', 'csv', 'pdf'] as const).map(format => ({
      key: format,
      label: format.toUpperCase(),
      run: async () => {
        try {
          await exportTable(format, filename, [columns.map(column => column.title),
            ...rows.map(row => columns.map(column => column.render(row)))]);
        } catch (failure) {
          toast.error(error(failure));
        }
      },
    })),
  });
}
