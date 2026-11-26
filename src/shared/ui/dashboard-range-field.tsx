import { dashboardRanges, type DashboardRange } from '../dashboard-range';
import { useGlobalization } from '../globalization';
import { SelectField } from './primitives';

export function DashboardRangeField({ range, onChange }: {
  range: DashboardRange; onChange: (range: DashboardRange) => void;
}) {
  const { t } = useGlobalization();
  return <SelectField label={t('DateRange', undefined, 'Core')} value={range}
    options={dashboardRanges.map(value => ({ value, label: value === 'All' ? t('Common.All') : t(value, undefined, 'Core') }))}
    onChange={value => {
      const next = dashboardRanges.find(item => item === value);
      if (next) onChange(next);
    }} />;
}
