import Icon from '../common/Icon';
import GraphVisualization from '../GraphVisualization';
import GraphLoader from '../graph/GraphLoader';
import GraphEmptyState from '../graph/GraphEmptyState';
import { cancelButton, uploadOverlay } from '../graph/graphClasses';
import { ConceptProgress } from '../../types/chat';
import { fileStripBar, fileStripChip, fileStripChipLink, panelLabel, panelSection } from './workspaceClasses';

interface GraphPanelProps {
  graphData: any;
  conceptProgress: ConceptProgress[];
  isGraphLoading: boolean;
  isProcessingFile: boolean;
  uploadProgress: number;
  progressMessage: string;
  focusedConcept: string | null;
  focusClearToken: number;
  sourceFiles?: string[];
  /** Link to the uploaded document, when it is still available in this session */
  sourceFileUrl?: string;
  onFocusChange: (label: string | null) => void;
  onClearFocus: () => void;
  onChooseFile: () => void;
  onCancelUpload: () => void;
}

interface SourceChipProps {
  file: string;
  /** Opens the document in a new tab when provided */
  href?: string;
}

/** File name chip for the source file strip; a link when the document is still available */
function SourceChip({ file, href }: SourceChipProps) {
  if (href) {
    return (
      <a className={fileStripChipLink} href={href} target="_blank" rel="noreferrer" title={file}>
        {file}
      </a>
    );
  }
  return (
    <span className={fileStripChip} title={file}>
      {file}
    </span>
  );
}

/** Knowledge map panel: header with node/link counts, the graph canvas, and the source file strip */
export default function GraphPanel({
  graphData,
  conceptProgress,
  isGraphLoading,
  isProcessingFile,
  uploadProgress,
  progressMessage,
  focusClearToken,
  sourceFiles = [],
  sourceFileUrl,
  onFocusChange,
  onChooseFile,
  onCancelUpload,
}: GraphPanelProps) {
  const nodesCount = graphData?.graph?.nodes?.length || 0;
  const relsCount = graphData?.graph?.relationships?.length || 0;
  const hasGraph = nodesCount > 0;
  // A graph is built from the most recent upload only, so that is the document it is named after
  const latestSourceFile = sourceFiles[sourceFiles.length - 1];
  // Restoring a saved chat: its source files are known before its graph arrives, so don't show them yet
  const isRestoringGraph = isGraphLoading && !hasGraph && !isProcessingFile;

  return (
    <section className={`graph-panel dock-panel-content ${panelSection}`}>
      <div className={panelLabel}>
        <span>Knowledge map</span>
        {hasGraph && (
          <div className="font-medium normal-case tracking-normal text-faint">
            <span>{nodesCount} {nodesCount === 1 ? 'node' : 'nodes'}</span>
            <span> · </span>
            <span>{relsCount} {relsCount === 1 ? 'link' : 'links'}</span>
          </div>
        )}
      </div>

      <div className="relative min-h-0 flex-1 overflow-hidden bg-[#f7f9f8] bg-[radial-gradient(#ccd7d5_1px,transparent_1px)] bg-size-[19px_19px]">
        {isProcessingFile ? (
          <div className={uploadOverlay}>
            <GraphLoader
              title="Processing your document"
              detail={progressMessage || 'Extracting concepts and building knowledge graph…'}
              progress={uploadProgress}
            >
              <button type="button" className={cancelButton} onClick={onCancelUpload}>
                Cancel processing
              </button>
            </GraphLoader>
          </div>
        ) : isGraphLoading && !hasGraph ? (
          <GraphLoader title="Loading knowledge graph" detail="Restoring concepts and relationships…" />
        ) : hasGraph ? (
          <GraphVisualization
            data={graphData}
            conceptProgress={conceptProgress}
            isLoading={isGraphLoading}
            onFocusChange={onFocusChange}
            focusClearToken={focusClearToken}
          />
        ) : (
          <GraphEmptyState onChooseFile={onChooseFile} />
        )}
      </div>

      <div className={fileStripBar}>
        <Icon name="file" size={16} />
        {hasGraph && latestSourceFile ? (
          <div className="flex min-w-0 flex-1 flex-row items-center gap-1.25">
            <span className="flex-none whitespace-nowrap">Document graph generated -</span>
            <SourceChip file={latestSourceFile} href={sourceFileUrl} />
          </div>
        ) : hasGraph ? (
          <span className="min-w-0 flex-1 truncate">Document graph generated</span>
        ) : isRestoringGraph ? (
          <span className="min-w-0 flex-1 truncate">Loading knowledge graph…</span>
        ) : sourceFiles.length > 0 ? (
          <>
            <strong className="flex-none whitespace-nowrap text-[10px] font-bold uppercase tracking-[0.04em]">
              {sourceFiles.length} source {sourceFiles.length === 1 ? 'file' : 'files'}
            </strong>
            <div className="flex min-w-0 flex-1 flex-row items-center gap-1.25">
              {sourceFiles.slice(0, 3).map((file, idx) => (
                <SourceChip
                  key={`${file}-${idx}`}
                  file={file}
                  href={sourceFileUrl && idx === sourceFiles.length - 1 ? sourceFileUrl : undefined}
                />
              ))}
              {sourceFiles.length > 3 && <span className={fileStripChip}>+{sourceFiles.length - 3}</span>}
            </div>
          </>
        ) : (
          <span className="min-w-0 flex-1 truncate">No source files yet</span>
        )}
      </div>
    </section>
  );
}
