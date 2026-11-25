import { useCallback, useEffect, useState } from 'react';

type Result<T> =
  | { state: 'loading'; previousData?: T }
  | { state: 'error'; error: unknown }
  | { state: 'ready'; data: T };

export function useResource<T>(load: (signal: AbortSignal) => Promise<T>) {
  const [version, setVersion] = useState(0);
  const [result, setResult] = useState<{ loader: typeof load; version: number; value: Result<T> }>();
  const refresh = useCallback(() => setVersion(value => value + 1), []);
  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal).then(data => {
      if (!controller.signal.aborted) setResult({ loader: load, version, value: { state: 'ready', data } });
    }).catch(error => {
      if (!controller.signal.aborted) setResult({ loader: load, version, value: { state: 'error', error } });
    });
    return () => controller.abort();
  }, [load, version]);
  const value: Result<T> = result?.loader === load && result.version === version
    ? result.value : { state: 'loading', previousData: result?.value.state === 'ready' ? result.value.data : undefined };
  return { ...value, refresh };
}
