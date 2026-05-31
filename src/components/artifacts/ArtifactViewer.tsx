import { ExternalLink, FileCode2, FileJson, FileText, Link2, ScrollText } from 'lucide-react';
import type { Artifact } from '../../domain/types';
import type { ArtifactPreviewViewModel } from '../../domain/selectors';
import { Badge } from '../ui/DemoPrimitives';

type ArtifactViewerProps = {
  artifacts: Artifact[];
  selectedArtifactId?: string;
  preview?: ArtifactPreviewViewModel;
  compact?: boolean;
  onSelectArtifact?: (artifactId: string) => void;
};

const typeIcon = {
  markdown: FileText,
  report: ScrollText,
  code: FileCode2,
  json: FileJson,
  patch: FileCode2,
  link: Link2,
  image: FileText,
  document: FileText,
  log: ScrollText,
  screenshot: FileText,
  archive: FileText,
  unknown: FileText,
} satisfies Record<Artifact['type'], typeof FileText>;

function sourceTone(source: ArtifactPreviewViewModel['source']) {
  if (source === 'paperclip') return 'purple';
  if (source === 'hermes') return 'blue';
  return 'slate';
}

function artifactLabel(artifact: Artifact) {
  const source = artifact.source ?? 'mock';
  return `${artifact.name} (${artifact.type}, ${source})`;
}

export function ArtifactList({ artifacts, selectedArtifactId, onSelectArtifact, compact = false }: ArtifactViewerProps) {
  if (artifacts.length === 0) {
    return <div className="rounded-lg border border-dashed border-slate-200 p-3 text-xs font-medium text-slate-500">No runtime artifacts yet.</div>;
  }

  return (
    <div data-artifact-list className="space-y-2">
      {artifacts.slice(0, compact ? 4 : artifacts.length).map((artifact) => {
        const Icon = typeIcon[artifact.type] ?? FileText;
        const active = artifact.id === selectedArtifactId;
        return (
          <button
            key={artifact.id}
            type="button"
            data-artifact-id={artifact.id}
            aria-label={`Preview ${artifactLabel(artifact)}`}
            onClick={() => onSelectArtifact?.(artifact.id)}
            className={`grid w-full grid-cols-[28px_1fr_auto] items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-xs transition ${active ? 'border-brand-500 bg-blue-50 text-brand-700' : 'border-slate-100 bg-white text-slate-700 hover:border-blue-200'}`}
          >
            <span className="grid h-7 w-7 place-items-center rounded-md bg-slate-100 text-slate-600">
              <Icon className="h-3.5 w-3.5" />
            </span>
            <span className="min-w-0">
              <span className="block truncate font-bold">{artifact.name}</span>
              <span className="block truncate text-[11px] text-slate-500">{artifact.type} · {artifact.source ?? 'mock'}</span>
            </span>
            <Badge tone={artifact.source === 'paperclip' ? 'purple' : artifact.source === 'hermes' ? 'blue' : 'slate'}>{artifact.type}</Badge>
          </button>
        );
      })}
    </div>
  );
}

export function MarkdownArtifactView({ preview, compact = false }: { preview: ArtifactPreviewViewModel; compact?: boolean }) {
  const text = preview.contentText ?? preview.contentSummary;
  const lines = text.split('\n').filter((line) => compact ? line.trim().length > 0 : true).slice(0, compact ? 6 : 16);
  return (
    <div data-artifact-markdown className="space-y-2 text-xs leading-5 text-slate-700">
      {lines.map((line, index) => {
        if (line.startsWith('# ')) return <h4 key={index} className="text-sm font-bold text-slate-950">{line.replace(/^# /, '')}</h4>;
        if (line.startsWith('## ')) return <h5 key={index} className="font-bold text-slate-800">{line.replace(/^## /, '')}</h5>;
        if (line.startsWith('- ')) return <div key={index} className="pl-3 text-slate-600">• {line.replace(/^- /, '')}</div>;
        return line.trim() ? <p key={index}>{line}</p> : <div key={index} className="h-1" />;
      })}
    </div>
  );
}

export function CodeArtifactView({ preview, compact = false }: { preview: ArtifactPreviewViewModel; compact?: boolean }) {
  return (
    <pre data-artifact-code className={`overflow-hidden rounded-lg bg-slate-950 p-3 font-mono text-[11px] leading-5 text-slate-100 ${compact ? 'max-h-32' : 'max-h-72 overflow-auto'}`}>
      {preview.contentText ?? preview.contentSummary}
    </pre>
  );
}

export function JsonArtifactView({ preview, compact = false }: { preview: ArtifactPreviewViewModel; compact?: boolean }) {
  const jsonText = JSON.stringify(preview.contentJson ?? { summary: preview.contentSummary }, null, 2);
  return (
    <pre data-artifact-json className={`overflow-hidden rounded-lg bg-slate-950 p-3 font-mono text-[11px] leading-5 text-cyan-100 ${compact ? 'max-h-32' : 'max-h-72 overflow-auto'}`}>
      {jsonText}
    </pre>
  );
}

export function PatchArtifactView({ preview, compact = false }: { preview: ArtifactPreviewViewModel; compact?: boolean }) {
  return <CodeArtifactView preview={{ ...preview, language: preview.language ?? 'diff' }} compact={compact} />;
}

export function LinkArtifactView({ preview }: { preview: ArtifactPreviewViewModel }) {
  return (
    <a data-artifact-link className="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-bold text-brand-700" href={preview.url ?? '#'} target="_blank" rel="noreferrer">
      <ExternalLink className="h-3.5 w-3.5" />
      Open artifact
    </a>
  );
}

export function UnknownArtifactView({ preview }: { preview: ArtifactPreviewViewModel }) {
  return <p data-artifact-unknown className="text-xs leading-5 text-slate-600">{preview.contentSummary}</p>;
}

export function ArtifactPreviewPanel({ preview, compact = false }: { preview?: ArtifactPreviewViewModel; compact?: boolean }) {
  if (!preview) {
    return <div data-artifact-preview className="rounded-lg border border-dashed border-slate-200 p-3 text-xs font-medium text-slate-500">No artifact selected.</div>;
  }

  const View = preview.type === 'json'
    ? JsonArtifactView
    : preview.type === 'code'
      ? CodeArtifactView
      : preview.type === 'patch'
        ? PatchArtifactView
        : preview.type === 'link'
          ? LinkArtifactView
          : preview.type === 'markdown' || preview.type === 'report'
            ? MarkdownArtifactView
            : UnknownArtifactView;

  return (
    <div data-artifact-preview data-artifact-preview-id={preview.id} className="space-y-3 rounded-lg border border-slate-100 bg-slate-50 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-bold text-slate-950">Selected {preview.type} artifact</div>
          <div className="mt-1 truncate text-[11px] font-medium text-slate-500">{preview.createdLabel} · {preview.sizeLabel}</div>
        </div>
        <Badge tone={sourceTone(preview.source)}>{preview.source}</Badge>
      </div>
      <p className="line-clamp-2 text-xs leading-5 text-slate-600">{preview.contentSummary}</p>
      <View preview={preview} compact={compact} />
    </div>
  );
}

export function ArtifactViewer({ artifacts, selectedArtifactId, preview, compact = false, onSelectArtifact }: ArtifactViewerProps) {
  return (
    <div data-artifact-viewer className={`grid gap-3 ${compact ? '' : 'grid-cols-[260px_1fr]'}`}>
      <ArtifactList artifacts={artifacts} selectedArtifactId={selectedArtifactId} onSelectArtifact={onSelectArtifact} compact={compact} />
      <ArtifactPreviewPanel preview={preview} compact={compact} />
    </div>
  );
}
