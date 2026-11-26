import { useGlobalization } from '../globalization';
import { StatusPanel } from './page';

export interface CountEntry { name: string; count: number }

const chartColors = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)'];

export function CountDistribution({ rows, variant = 'bars' }: {
  rows: CountEntry[]; variant?: 'bars' | 'donut';
}) {
  const { number } = useGlobalization();
  if (!rows.length) return <StatusPanel kind="empty" />;
  const max = rows.reduce((highest, row) => Math.max(highest, row.count), 1);
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  let start = 0;
  const segments = total ? rows.map(({ count }, index) => {
    const end = start + count * 100 / total;
    const stop = `${chartColors[index % chartColors.length]} ${start}% ${end}%`;
    start = end;
    return stop;
  }) : [];
  return <div className="flex min-w-0 flex-wrap items-center gap-4">
    {variant === 'donut' && total > 0 && <div aria-hidden="true"
      className="mx-auto grid aspect-square w-28 shrink-0 place-items-center rounded-full sm:w-36"
      style={{ backgroundImage: `conic-gradient(${segments.join(', ')})` }}>
      <span className="size-1/2 rounded-full bg-card" />
    </div>}
    <ul className="grid min-w-0 flex-1 list-none gap-2 p-0">
      {rows.map((row, index) => <li key={index} className="min-w-0">
        <div className="flex items-baseline justify-between gap-2 text-sm">
          <span className="break-words">{variant === 'donut' && <span aria-hidden="true"
            className="mr-2 inline-block size-2 rounded-full" style={{ backgroundColor: chartColors[index % chartColors.length] }} />}
            {row.name}</span>
          <span className="tabular-nums">{number.format(row.count)}</span>
        </div>
        {variant === 'bars' && <meter aria-label={row.name} className="w-full" min={0} max={max} value={row.count} />}
      </li>)}
    </ul>
  </div>;
}
