import { useState, useEffect, useCallback } from 'react';
import {
  MagnifyingGlassIcon,
  FunnelIcon,
  TrashIcon,
  ArrowTopRightOnSquareIcon,
  CheckCircleIcon,
  XCircleIcon,
  DocumentTextIcon,
  TableCellsIcon,
  PresentationChartBarIcon,
  EnvelopeIcon,
  FolderIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from '@heroicons/react/24/outline';
import {
  getWorkspaceDocuments,
  toggleWorkspaceDocument,
  bulkToggleWorkspaceDocuments,
  deleteWorkspaceDocument,
  getWorkspaceDocument,
  type WorkspaceDocument,
  type WorkspaceDocumentDetail,
} from '../../lib/api';

const SOURCE_ICONS: Record<string, React.ComponentType<React.SVGProps<SVGSVGElement>>> = {
  GOOGLE_DOC: DocumentTextIcon,
  GOOGLE_SHEET: TableCellsIcon,
  GOOGLE_SLIDE: PresentationChartBarIcon,
  GMAIL: EnvelopeIcon,
  DRIVE_FILE: FolderIcon,
};

const SOURCE_LABELS: Record<string, string> = {
  GOOGLE_DOC: 'Doc',
  GOOGLE_SHEET: 'Sheet',
  GOOGLE_SLIDE: 'Slide',
  GMAIL: 'Email',
  DRIVE_FILE: 'File',
};

const SOURCE_COLORS: Record<string, string> = {
  GOOGLE_DOC: 'bg-blue-50 text-blue-700',
  GOOGLE_SHEET: 'bg-green-50 text-green-700',
  GOOGLE_SLIDE: 'bg-amber-50 text-amber-700',
  GMAIL: 'bg-red-50 text-red-700',
  DRIVE_FILE: 'bg-neutral-50 text-neutral-700',
};

type FilterMode = 'all' | 'enabled' | 'disabled';

export default function WorkspaceReview() {
  const [documents, setDocuments] = useState<WorkspaceDocument[]>([]);
  const [stats, setStats] = useState({ total: 0, enabled: 0, disabled: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedDoc, setExpandedDoc] = useState<WorkspaceDocumentDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const loadDocuments = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (search) params.search = search;
      if (sourceFilter) params.sourceType = sourceFilter;
      if (filterMode === 'enabled') params.enabled = 'true';
      if (filterMode === 'disabled') params.enabled = 'false';

      const data = await getWorkspaceDocuments(params);
      setDocuments(data.documents);
      setStats(data.stats);
    } catch (err) {
      console.error('Failed to load workspace documents:', err);
    } finally {
      setLoading(false);
    }
  }, [search, sourceFilter, filterMode]);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  const handleToggle = async (id: string, isEnabled: boolean) => {
    try {
      await toggleWorkspaceDocument(id, isEnabled);
      setDocuments((prev) =>
        prev.map((d) => (d.id === id ? { ...d, isEnabled } : d))
      );
      setStats((prev) => ({
        ...prev,
        enabled: prev.enabled + (isEnabled ? 1 : -1),
        disabled: prev.disabled + (isEnabled ? -1 : 1),
      }));
    } catch (err) {
      console.error('Failed to toggle document:', err);
    }
  };

  const handleBulkToggle = async (isEnabled: boolean) => {
    if (selectedIds.size === 0) return;
    try {
      await bulkToggleWorkspaceDocuments([...selectedIds], isEnabled);
      setDocuments((prev) =>
        prev.map((d) => (selectedIds.has(d.id) ? { ...d, isEnabled } : d))
      );
      setSelectedIds(new Set());
      loadDocuments();
    } catch (err) {
      console.error('Failed to bulk toggle:', err);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteWorkspaceDocument(id);
      setDocuments((prev) => prev.filter((d) => d.id !== id));
      setStats((prev) => ({ ...prev, total: prev.total - 1 }));
      if (expandedId === id) {
        setExpandedId(null);
        setExpandedDoc(null);
      }
    } catch (err) {
      console.error('Failed to delete document:', err);
    }
  };

  const handleExpand = async (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
      setExpandedDoc(null);
      return;
    }

    setExpandedId(id);
    setLoadingDetail(true);
    try {
      const detail = await getWorkspaceDocument(id);
      setExpandedDoc(detail);
    } catch (err) {
      console.error('Failed to load document detail:', err);
    } finally {
      setLoadingDetail(false);
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === documents.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(documents.map((d) => d.id)));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <div>
      {/* Stats bar */}
      <div className="flex items-center gap-6 mb-4">
        <div className="text-sm text-neutral-500">
          <span className="font-medium text-neutral-900">{stats.total}</span> documents
        </div>
        <div className="text-sm text-green-600">
          <CheckCircleIcon className="h-4 w-4 inline mr-1" />
          {stats.enabled} enabled
        </div>
        <div className="text-sm text-neutral-400">
          <XCircleIcon className="h-4 w-4 inline mr-1" />
          {stats.disabled} disabled
        </div>
      </div>

      {/* Search + filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <MagnifyingGlassIcon className="h-5 w-5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search documents..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-stc-purple-300 focus:border-stc-purple-300 min-h-[44px]"
          />
        </div>

        <div className="flex gap-2">
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-neutral-200 text-sm min-h-[44px]"
          >
            <option value="">All types</option>
            <option value="GOOGLE_DOC">Docs</option>
            <option value="GOOGLE_SHEET">Sheets</option>
            <option value="GOOGLE_SLIDE">Slides</option>
            <option value="GMAIL">Email</option>
          </select>

          <div className="flex rounded-xl border border-neutral-200 overflow-hidden">
            {(['all', 'enabled', 'disabled'] as FilterMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => setFilterMode(mode)}
                className={`px-3 py-2 text-sm capitalize min-h-[44px] transition-colors ${
                  filterMode === mode
                    ? 'bg-stc-purple-50 text-stc-purple-700 font-medium'
                    : 'text-neutral-500 hover:bg-neutral-50'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Bulk actions */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 mb-4 p-3 bg-stc-purple-50 rounded-xl">
          <span className="text-sm font-medium text-stc-purple-700">
            {selectedIds.size} selected
          </span>
          <button
            onClick={() => handleBulkToggle(true)}
            className="px-3 py-1.5 text-sm bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors min-h-[44px]"
          >
            Enable all
          </button>
          <button
            onClick={() => handleBulkToggle(false)}
            className="px-3 py-1.5 text-sm bg-neutral-100 text-neutral-600 rounded-lg hover:bg-neutral-200 transition-colors min-h-[44px]"
          >
            Disable all
          </button>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="px-3 py-1.5 text-sm text-neutral-500 hover:text-neutral-700 min-h-[44px]"
          >
            Clear
          </button>
        </div>
      )}

      {/* Document list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="bg-white rounded-xl border border-neutral-200 p-4 animate-pulse">
              <div className="flex items-center gap-3">
                <div className="w-5 h-5 bg-neutral-200 rounded" />
                <div className="w-16 h-5 bg-neutral-200 rounded" />
                <div className="flex-1 h-5 bg-neutral-200 rounded w-2/3" />
              </div>
            </div>
          ))}
        </div>
      ) : documents.length === 0 ? (
        <div className="text-center py-12 text-neutral-400">
          <FunnelIcon className="h-8 w-8 mx-auto mb-2" />
          <p className="text-sm">No documents found</p>
          <p className="text-xs mt-1">Run the workspace crawler to discover content</p>
        </div>
      ) : (
        <div className="space-y-1">
          {/* Select all header */}
          <div className="flex items-center gap-3 px-4 py-2 text-xs text-neutral-400">
            <input
              type="checkbox"
              checked={selectedIds.size === documents.length && documents.length > 0}
              onChange={toggleSelectAll}
              className="rounded border-neutral-300 text-stc-purple-500 focus:ring-stc-purple-300 w-4 h-4"
            />
            <span className="w-16">Type</span>
            <span className="flex-1">Title</span>
            <span className="w-20 text-right">Chunks</span>
            <span className="w-24 text-right">Owner</span>
            <span className="w-28 text-right">Modified</span>
            <span className="w-24 text-right">Actions</span>
          </div>

          {documents.map((doc) => {
            const Icon = SOURCE_ICONS[doc.sourceType] || FolderIcon;
            const isExpanded = expandedId === doc.id;

            return (
              <div key={doc.id}>
                <div
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all duration-200 ${
                    doc.isEnabled
                      ? 'bg-white border-neutral-200 hover:border-neutral-300'
                      : 'bg-neutral-50 border-neutral-100 opacity-60'
                  } ${isExpanded ? 'ring-1 ring-stc-purple-200' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.has(doc.id)}
                    onChange={() => toggleSelect(doc.id)}
                    className="rounded border-neutral-300 text-stc-purple-500 focus:ring-stc-purple-300 w-4 h-4"
                  />

                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium ${SOURCE_COLORS[doc.sourceType] || 'bg-neutral-50 text-neutral-600'}`}>
                    <Icon className="h-3.5 w-3.5" />
                    {SOURCE_LABELS[doc.sourceType] || doc.sourceType}
                  </span>

                  <button
                    onClick={() => handleExpand(doc.id)}
                    className="flex-1 text-left text-sm font-medium text-neutral-800 hover:text-stc-purple-600 truncate min-h-[44px] flex items-center gap-1"
                  >
                    {doc.title}
                    {isExpanded ? (
                      <ChevronUpIcon className="h-3.5 w-3.5 text-neutral-400 flex-shrink-0" />
                    ) : (
                      <ChevronDownIcon className="h-3.5 w-3.5 text-neutral-400 flex-shrink-0" />
                    )}
                  </button>

                  <span className="w-20 text-right text-xs text-neutral-500">
                    {doc.chunkCount} chunks
                  </span>

                  <span className="w-24 text-right text-xs text-neutral-400 truncate">
                    {doc.ownerEmail?.split('@')[0] || '—'}
                  </span>

                  <span className="w-28 text-right text-xs text-neutral-400">
                    {formatDate(doc.lastModified)}
                  </span>

                  <div className="w-24 flex items-center justify-end gap-1">
                    {doc.driveUrl && (
                      <a
                        href={doc.driveUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 text-neutral-400 hover:text-stc-purple-500 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                        title="Open in Drive"
                      >
                        <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                      </a>
                    )}

                    <button
                      onClick={() => handleToggle(doc.id, !doc.isEnabled)}
                      className={`p-2 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center ${
                        doc.isEnabled
                          ? 'text-green-500 hover:text-green-700'
                          : 'text-neutral-300 hover:text-green-500'
                      }`}
                      title={doc.isEnabled ? 'Disable (exclude from RAG)' : 'Enable (include in RAG)'}
                    >
                      {doc.isEnabled ? (
                        <CheckCircleIcon className="h-5 w-5" />
                      ) : (
                        <XCircleIcon className="h-5 w-5" />
                      )}
                    </button>

                    <button
                      onClick={() => handleDelete(doc.id)}
                      className="p-2 text-neutral-300 hover:text-red-500 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                      title="Delete document and chunks"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="ml-8 mr-4 mt-1 mb-2 p-4 bg-neutral-50 rounded-xl border border-neutral-100">
                    {loadingDetail ? (
                      <div className="animate-pulse space-y-2">
                        <div className="h-4 bg-neutral-200 rounded w-1/2" />
                        <div className="h-20 bg-neutral-200 rounded" />
                      </div>
                    ) : expandedDoc ? (
                      <div>
                        <div className="flex items-center gap-4 mb-3 text-xs text-neutral-500">
                          <span>{expandedDoc.chunks.length} chunks</span>
                          <span>·</span>
                          <span>{expandedDoc.rawContent.length.toLocaleString()} chars</span>
                          <span>·</span>
                          <span>~{Math.ceil(expandedDoc.rawContent.length / 4).toLocaleString()} tokens</span>
                        </div>

                        <div className="mb-3">
                          <h4 className="text-xs font-medium text-neutral-600 mb-1">Content Preview</h4>
                          <pre className="text-xs text-neutral-600 bg-white p-3 rounded-lg border border-neutral-200 max-h-48 overflow-y-auto whitespace-pre-wrap font-mono">
                            {expandedDoc.rawContent.slice(0, 2000)}
                            {expandedDoc.rawContent.length > 2000 && '\n\n... (truncated)'}
                          </pre>
                        </div>

                        <div>
                          <h4 className="text-xs font-medium text-neutral-600 mb-1">
                            Chunks ({expandedDoc.chunks.length})
                          </h4>
                          <div className="space-y-1 max-h-48 overflow-y-auto">
                            {expandedDoc.chunks.map((chunk) => (
                              <div
                                key={chunk.id}
                                className="text-xs bg-white p-2 rounded border border-neutral-100"
                              >
                                <span className="text-neutral-400 mr-2">#{chunk.sequence + 1}</span>
                                <span className="text-neutral-600">
                                  {chunk.content.slice(0, 150)}
                                  {chunk.content.length > 150 && '...'}
                                </span>
                                <span className="text-neutral-400 ml-2">({chunk.tokenCount} tok)</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-neutral-400">Failed to load detail</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
