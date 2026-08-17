export { IworkContainerMismatchError } from './errors.js';
export { DEFAULT_IWORK_PARSE_LIMITS } from './limits.js';
export const inspectIworkContainer = async (
  ...args: Parameters<typeof import('./parser.js')['inspectIworkContainer']>
) => {
  const parser = await import('./iwork.parser.js');
  return parser.inspectIworkContainer(...args);
};
export const parseIworkDocument = async (
  ...args: Parameters<typeof import('./parser.js')['parseIworkDocument']>
) => {
  const parser = await import('./iwork.parser.js');
  return parser.parseIworkDocument(...args);
};
export { decompressIwaFile } from './snappy.js';
export {
  IWORK_VIEWER_STYLE,
  renderIworkDocument,
} from './viewer.js';
export {
  parseIworkWithWorker,
  resolveIworkWorkerUrl,
} from './workerClient.js';
export type {
  IworkDocument,
  IworkEmbeddedPreview,
  IworkGeneration,
  IworkKind,
  IworkParseLimits,
  IworkScene,
  IworkTable,
  IworkTextBlock,
  IworkVisualObject,
} from './model.js';
export type {
  IworkViewerFitMode,
  IworkViewerFitViewport,
  IworkViewerInstance,
  IworkViewerOptions,
  IworkViewerSource,
  IworkViewerZoomState,
} from './viewer.js';
export type {
  IworkEmbeddedPreviewMode,
  IworkWorkerOptions,
} from './workerClient.js';

export { renderIworkDocument as default } from './viewer.js';
