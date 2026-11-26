export function localDateTimeInput(value: string | null | undefined, timeZone: string) {
  if (!value) return '';
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return '';
  const formatter = new Intl.DateTimeFormat('en-GB-u-ca-iso8601-nu-latn', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  });
  const parts = Object.fromEntries(formatter.formatToParts(timestamp).map(part => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

export function localDateTimeInstant(value: string, timeZone: string, original?: string | null) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return undefined;
  if (original && localDateTimeInput(original, timeZone) === value) return original;
  const wallTime = Date.parse(value + 'Z');
  if (!Number.isFinite(wallTime)) return undefined;

  // Probe both sides of a possible clock change and accept one round-tripping instant.
  const day = 24 * 60 * 60 * 1000;
  const instants = new Set<number>();
  for (const probe of [wallTime - day, wallTime, wallTime + day]) {
    const offset = Date.parse(localDateTimeInput(new Date(probe).toISOString(), timeZone) + 'Z') - probe;
    const instant = wallTime - offset;
    if (Number.isFinite(instant) && localDateTimeInput(new Date(instant).toISOString(), timeZone) === value) instants.add(instant);
  }
  if (instants.size === 1) {
    const [instant] = instants;
    return new Date(instant).toISOString();
  }
}

export function localDateInput(value: string | null | undefined, timeZone: string) {
  return localDateTimeInput(value, timeZone).slice(0, 10);
}

export function localDateInstant(value: string, timeZone: string, original?: string | null) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  if (original && localDateInput(original, timeZone) === value) return original;
  return localDateTimeInstant(value + 'T00:00', timeZone);
}
