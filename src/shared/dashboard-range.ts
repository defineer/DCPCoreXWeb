import { localDateInput } from './zoned-dates';

export const dashboardRanges = ['All', 'Today', 'Week', 'Month', 'Year'] as const;
export type DashboardRange = typeof dashboardRanges[number];

export function dashboardDateRange(range: DashboardRange, timeZone: string, culture: string, now = new Date()) {
  if (range === 'All') return undefined;
  const localDate = localDateInput(now.toISOString(), timeZone);
  const start = new Date(localDate + 'T00:00:00Z');
  const end = new Date(start);
  if (range === 'Week') {
    const firstDay = culture === 'tr-TR' ? 1 : 0;
    start.setUTCDate(start.getUTCDate() - ((7 + start.getUTCDay() - firstDay) % 7));
    end.setTime(start.getTime());
    end.setUTCDate(end.getUTCDate() + 6);
  } else if (range === 'Month' || range === 'Year') {
    if (range === 'Year') {
      start.setUTCMonth(0);
      end.setUTCMonth(11);
    }
    start.setUTCDate(1);
    end.setUTCMonth(end.getUTCMonth() + 1, 0);
  }
  return { localStartDate: start.toISOString().slice(0, 10), localEndDate: end.toISOString().slice(0, 10) };
}
