export type FileViewerFitMode = 'auto' | 'contain' | 'cover' | 'width' | 'height' | 'actual' | 'scale-down';
export type FileViewerFitResize = 'until-interaction' | 'always' | 'initial';
export type FileViewerViewStateChangeSource = 'viewer' | 'user' | 'api' | (string & {});

export interface FileViewerZoomState {
  scale: number;
  label: string;
  canZoomIn: boolean;
  canZoomOut: boolean;
  canReset: boolean;
  minScale?: number;
  maxScale?: number;
}

export interface FileViewerFitRequest {
  mode: FileViewerFitMode;
  resize: FileViewerFitResize;
  padding: number;
  source: FileViewerViewStateChangeSource;
  reason: 'initial' | 'resize' | 'api' | 'retry';
  viewportWidth: number;
  viewportHeight: number;
  container?: HTMLElement | null;
}

export interface FileViewerFitResult {
  applied: boolean;
  mode: FileViewerFitMode;
  resize: FileViewerFitResize;
  scale?: number;
  source?: FileViewerViewStateChangeSource;
  reason?: string;
  provider?: 'view-state' | 'zoom' | 'none' | (string & {});
}

export interface FileViewerIworkOptions {
  workerUrl?: string | URL;
  useWorker?: boolean;
  workerTimeoutMs?: number;
  maxUncompressedBytes?: number;
  maxCompressionRatio?: number;
  maxObjects?: number;
  maxImagePixels?: number;
  maxNestingDepth?: number;
  embeddedPreview?: 'never' | 'loading' | 'fallback';
}

export interface FileRenderContext {
  signal?: AbortSignal;
  options?: { iwork?: FileViewerIworkOptions };
  registerExportAdapter?: (adapter: {
    includeDocumentStyles?: boolean;
    getPrintMaskPages?: () => readonly HTMLElement[];
    printStyle?: string;
    toHtml?: () => string | Promise<string>;
  } | null) => void;
  registerThumbnailAdapter?: (adapter: {
    captureSource?: 'embedded' | 'rendered';
    capture?: () => Blob | null | Promise<Blob | null>;
    getTarget?: () => Element | null | Promise<Element | null>;
  } | null) => void;
}

export type FileViewerRenderedInstance = {
  $el?: Node;
  unmount: () => void | Promise<void>;
};

export type FileRenderHandler<Rendered = unknown, Target extends HTMLElement = HTMLElement> = (
  buffer: ArrayBuffer,
  target: Target,
  type?: string,
  context?: FileRenderContext
) => Promise<Rendered>;

export interface RendererDefinition {
  id: string;
  label: string;
  extensions: readonly string[];
}

export interface FileViewerRendererPlugin<Handler = FileRenderHandler> {
  id: string;
  label?: string;
  definitions?: readonly RendererDefinition[];
  handlers?: readonly { rendererId: string; handler: Handler }[];
}

export const DEFAULT_RENDERER_DEFINITIONS: readonly RendererDefinition[];
export const resolveFileViewerIworkWorkerUrl: (
  options?: FileViewerIworkOptions,
  baseUrl?: string
) => string;
export const registerFileViewerZoomProvider: (
  host: HTMLElement,
  provider: {
    zoomIn: () => FileViewerZoomState;
    zoomOut: () => FileViewerZoomState;
    resetZoom: () => FileViewerZoomState;
    setZoom: (scale: number) => FileViewerZoomState;
    fit: (request: FileViewerFitRequest) => FileViewerFitResult;
    getState: () => FileViewerZoomState;
  }
) => void;
export const unregisterFileViewerZoomProvider: (host: HTMLElement) => void;
