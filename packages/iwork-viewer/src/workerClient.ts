import type { IworkDocument, IworkParseLimits } from './model.js';
import { IworkContainerMismatchError } from './errors.js';

export type IworkEmbeddedPreviewMode = 'never' | 'loading' | 'fallback';

export interface IworkWorkerOptions extends Partial<IworkParseLimits> {
  /** Explicit self-hosted module Worker URL. Defaults to the Worker shipped beside this module. */
  workerUrl?: string | URL;
  /** Defaults to true. Disable only when Worker is unavailable or deliberately undesired. */
  useWorker?: boolean;
  /** Maximum parse time before the Worker is terminated. Defaults to 60 seconds. */
  workerTimeoutMs?: number;
  /** Quick Look images are an explicit limited-preview fallback, never fidelity evidence. */
  embeddedPreview?: IworkEmbeddedPreviewMode;
}

interface WorkerResponse {
  id: number;
  ok: boolean;
  document?: IworkDocument;
  error?: { name?: string; message?: string; actualRendererId?: string };
}

let requestId = 0;

const parseLimits = (options?: IworkWorkerOptions): Partial<IworkParseLimits> => ({
  maxUncompressedBytes: options?.maxUncompressedBytes,
  maxCompressionRatio: options?.maxCompressionRatio,
  maxObjects: options?.maxObjects,
  maxImagePixels: options?.maxImagePixels,
  maxNestingDepth: options?.maxNestingDepth,
});

export const resolveIworkWorkerUrl = (options?: IworkWorkerOptions) =>
  options?.workerUrl ?? new URL('./iwork.worker.js', import.meta.url);

export const parseIworkWithWorker = async (
  buffer: ArrayBuffer,
  type: string | undefined,
  options?: IworkWorkerOptions,
  signal?: AbortSignal
) => {
  const limits = Object.fromEntries(Object.entries(parseLimits(options)).filter(([, value]) => value != null));
  if (options?.useWorker === false || typeof Worker === 'undefined') {
    const { parseIworkDocument } = await import('./iwork.parser.js');
    return parseIworkDocument(buffer, type, limits);
  }
  const worker = new Worker(resolveIworkWorkerUrl(options), { type: 'module', name: 'iwork-viewer-parser' });
  const id = ++requestId;
  const timeoutMs = Math.max(1_000, options?.workerTimeoutMs ?? 60_000);
  return new Promise<IworkDocument>((resolve, reject) => {
    let settled = false;
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
      worker.terminate();
      callback();
    };
    const onAbort = () => finish(() => reject(new DOMException('iWork parsing was aborted.', 'AbortError')));
    const timer = setTimeout(() => finish(() => reject(new Error(`iWork parsing exceeded ${timeoutMs}ms.`))), timeoutMs);
    worker.addEventListener('message', (event: MessageEvent<WorkerResponse>) => {
      if (event.data.id !== id) return;
      if (event.data.ok && event.data.document) {
        finish(() => resolve(event.data.document as IworkDocument));
        return;
      }
      const details = event.data.error;
      finish(() => {
        if (details?.name === 'IworkContainerMismatchError' && details.actualRendererId) {
          reject(new IworkContainerMismatchError(details.actualRendererId, details.message || 'iWork container mismatch.'));
        } else reject(new Error(details?.message || 'iWork Worker failed.'));
      });
    });
    worker.addEventListener('error', event => finish(() => reject(new Error(event.message || 'iWork Worker failed to load.'))));
    signal?.addEventListener('abort', onAbort, { once: true });
    if (signal?.aborted) { onAbort(); return; }
    const transferable = buffer.slice(0);
    worker.postMessage({ id, buffer: transferable, type, limits }, [transferable]);
  });
};
