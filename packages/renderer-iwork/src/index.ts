import {
  DEFAULT_RENDERER_DEFINITIONS,
  registerFileViewerZoomProvider,
  resolveFileViewerIworkWorkerUrl,
  unregisterFileViewerZoomProvider,
  type FileRenderHandler,
  type FileViewerFitRequest,
  type FileViewerFitResult,
  type FileViewerRenderedInstance,
  type FileViewerRendererPlugin,
  type RendererDefinition,
} from '@file-viewer/core';
import {
  renderIworkDocument,
  type IworkViewerFitMode,
} from 'iwork-viewer';

const definitions = ['apple-pages', 'apple-numbers', 'apple-keynote'].map(id =>
  DEFAULT_RENDERER_DEFINITIONS.find(definition => definition.id === id) as RendererDefinition | undefined
);

if (definitions.some(definition => !definition)) {
  throw new Error('@file-viewer/renderer-iwork could not locate the shared Pages, Numbers, and Keynote definitions.');
}

export const [pagesRendererDefinition, numbersRendererDefinition, keynoteRendererDefinition] =
  definitions as RendererDefinition[];

const toStandaloneFitMode = (mode: FileViewerFitRequest['mode']): IworkViewerFitMode =>
  mode === 'auto' ? 'width' : mode;

export const renderFileViewerIwork: FileRenderHandler<FileViewerRenderedInstance, HTMLDivElement> = async (
  buffer,
  target,
  type,
  context
) => {
  const options = context?.options?.iwork;
  const viewer = await renderIworkDocument(buffer, target, type, {
    ...options,
    workerUrl: resolveFileViewerIworkWorkerUrl(
      options,
      typeof document === 'undefined' ? undefined : document.baseURI
    ),
    signal: context?.signal,
  });

  const fit = (request: FileViewerFitRequest): FileViewerFitResult => {
    const state = viewer.fit(toStandaloneFitMode(request.mode), {
      width: request.viewportWidth,
      height: request.viewportHeight,
    });
    return state
      ? {
          applied: true,
          mode: request.mode,
          resize: request.resize,
          scale: state.scale,
          source: request.source,
          provider: 'zoom',
        }
      : {
          applied: false,
          mode: request.mode,
          resize: request.resize,
          source: request.source,
          reason: 'unmeasurable',
          provider: 'zoom',
        };
  };

  registerFileViewerZoomProvider(target, {
    zoomIn: viewer.zoomIn,
    zoomOut: viewer.zoomOut,
    resetZoom: viewer.resetZoom,
    setZoom: viewer.setZoom,
    fit,
    getState: viewer.getZoomState,
  });
  context?.registerExportAdapter?.({
    includeDocumentStyles: false,
    getPrintMaskPages: viewer.getPrintPages,
    printStyle: viewer.printStyle,
    toHtml: viewer.toHtml,
  });
  context?.registerThumbnailAdapter?.({
    captureSource: viewer.captureSource,
    capture: viewer.captureSource === 'embedded' ? viewer.captureEmbeddedPreview : undefined,
    getTarget: viewer.getThumbnailTarget,
  });

  return {
    $el: target,
    unmount() {
      unregisterFileViewerZoomProvider(target);
      context?.registerExportAdapter?.(null);
      context?.registerThumbnailAdapter?.(null);
      viewer.destroy();
    },
  };
};

export const iworkRenderer: FileViewerRendererPlugin<
  FileRenderHandler<FileViewerRenderedInstance, HTMLDivElement>
> = {
  id: 'file-viewer-renderer-iwork',
  label: 'File Viewer Apple iWork renderer',
  definitions: definitions as RendererDefinition[],
  handlers: (definitions as RendererDefinition[]).map(definition => ({
    rendererId: definition.id,
    handler: renderFileViewerIwork,
  })),
};

export default iworkRenderer;
