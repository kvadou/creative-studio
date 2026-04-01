import { useState, useEffect } from 'react';
import { DocumentDuplicateIcon, TrashIcon, UserIcon, UsersIcon } from '@heroicons/react/24/outline';
import { StarIcon } from '@heroicons/react/24/solid';
import {
  getTemplates,
  createTemplate,
  deleteTemplate,
  useTemplate,
  type LessonTemplate,
  type TemplateConfig,
} from '../../lib/api';

interface TemplatePanelProps {
  onApplyTemplate: (config: TemplateConfig) => void;
  currentConfig: TemplateConfig;
  projectId?: string;
  disabled?: boolean;
}

export function TemplatePanel({
  onApplyTemplate,
  currentConfig,
  projectId,
  disabled = false,
}: TemplatePanelProps) {
  const [templates, setTemplates] = useState<LessonTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [saveDescription, setSaveDescription] = useState('');
  const [saveType, setSaveType] = useState<'PERSONAL' | 'TEAM'>('PERSONAL');
  const [saving, setSaving] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Load templates on mount
  useEffect(() => {
    async function loadTemplates() {
      try {
        const data = await getTemplates(projectId);
        setTemplates(data);
      } catch (err) {
        console.error('Failed to load templates:', err);
        setError('Failed to load templates');
      } finally {
        setLoading(false);
      }
    }
    loadTemplates();
  }, [projectId]);

  // Apply a template
  const handleApply = async (template: LessonTemplate) => {
    onApplyTemplate(template.config);
    // Increment usage count in background
    useTemplate(template.id).catch(console.error);
  };

  // Save current config as template
  const handleSave = async () => {
    if (!saveName.trim()) return;

    setSaving(true);
    setError(null);

    try {
      const newTemplate = await createTemplate({
        name: saveName.trim(),
        description: saveDescription.trim() || undefined,
        type: saveType,
        projectId: saveType === 'TEAM' ? projectId : undefined,
        config: currentConfig,
      });

      setTemplates((prev) => [newTemplate, ...prev]);
      setShowSaveDialog(false);
      setSaveName('');
      setSaveDescription('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save template');
    } finally {
      setSaving(false);
    }
  };

  // Delete a template
  const handleDelete = async (id: string) => {
    try {
      await deleteTemplate(id);
      setTemplates((prev) => prev.filter((t) => t.id !== id));
      setDeleteConfirmId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete template');
    }
  };

  // Get icon based on template type
  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'BUILTIN':
        return <StarIcon className="w-4 h-4 text-stc-orange" />;
      case 'TEAM':
        return <UsersIcon className="w-4 h-4 text-stc-blue" />;
      default:
        return <UserIcon className="w-4 h-4 text-neutral-500" />;
    }
  };

  // Get label for age band
  const getAgeBandLabel = (ageBand?: string) => {
    switch (ageBand) {
      case 'THREE_TO_SEVEN':
        return '3-7yo';
      case 'EIGHT_TO_NINE':
        return '8-9yo';
      case 'TEN_TO_TWELVE':
        return '10-12yo';
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="p-4 text-center text-neutral-500 text-sm">
        Loading templates...
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-neutral-200 shadow-sm">
      {/* Header */}
      <div className="p-3 border-b border-neutral-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <DocumentDuplicateIcon className="w-5 h-5 text-stc-purple-500" />
          <span className="font-medium text-sm">Templates</span>
        </div>
        <button
          type="button"
          onClick={() => setShowSaveDialog(true)}
          disabled={disabled}
          className="text-xs px-2 py-1 bg-stc-purple-100 text-stc-purple-700 rounded hover:bg-stc-purple-200 disabled:opacity-50"
        >
          Save Current
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="p-2 bg-stc-pink/10 text-stc-pink text-xs border-b border-stc-pink/20">
          {error}
        </div>
      )}

      {/* Template List */}
      <div className="max-h-64 overflow-y-auto">
        {templates.length === 0 ? (
          <div className="p-4 text-center text-neutral-500 text-sm">
            No templates yet. Save your current settings to create one.
          </div>
        ) : (
          <div className="divide-y divide-neutral-100">
            {templates.map((template) => (
              <div
                key={template.id}
                className="p-3 hover:bg-neutral-50 flex items-start gap-3"
              >
                {/* Icon */}
                <div className="flex-shrink-0 mt-0.5">
                  {getTypeIcon(template.type)}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm truncate">{template.name}</span>
                    {template.config.ageBand && (
                      <span className="text-xs px-1.5 py-0.5 bg-neutral-100 text-neutral-600 rounded">
                        {getAgeBandLabel(template.config.ageBand)}
                      </span>
                    )}
                  </div>
                  {template.description && (
                    <p className="text-xs text-neutral-500 mt-0.5 line-clamp-1">{template.description}</p>
                  )}
                  <div className="flex items-center gap-2 mt-1 text-xs text-neutral-400">
                    {template.config.chessBasis && (
                      <span>{template.config.chessBasis.replace(/_/g, ' ').toLowerCase()}</span>
                    )}
                    {template.usageCount > 0 && (
                      <span>Used {template.usageCount}x</span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => handleApply(template)}
                    disabled={disabled}
                    className="text-xs px-2 py-1 bg-stc-purple-500 text-white rounded hover:bg-stc-purple-600 disabled:opacity-50"
                  >
                    Apply
                  </button>
                  {template.type !== 'BUILTIN' && (
                    deleteConfirmId === template.id ? (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleDelete(template.id)}
                          className="text-xs px-2 py-1 bg-stc-pink text-white rounded hover:bg-stc-pink"
                        >
                          Yes
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteConfirmId(null)}
                          className="text-xs px-2 py-1 bg-neutral-200 text-neutral-700 rounded hover:bg-neutral-300"
                        >
                          No
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setDeleteConfirmId(template.id)}
                        disabled={disabled}
                        className="text-xs p-1 text-neutral-400 hover:text-stc-pink disabled:opacity-50"
                        title="Delete template"
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    )
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Save Dialog */}
      {showSaveDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 p-4">
            <h3 className="font-bold text-lg mb-4">Save Template</h3>

            {/* Name */}
            <div className="mb-3">
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Template Name
              </label>
              <input
                type="text"
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                placeholder="e.g., Young Beginners - Forks"
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-stc-purple-100 focus:border-stc-purple-500"
                autoFocus
              />
            </div>

            {/* Description */}
            <div className="mb-3">
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Description <span className="font-normal text-neutral-500">(optional)</span>
              </label>
              <textarea
                value={saveDescription}
                onChange={(e) => setSaveDescription(e.target.value)}
                placeholder="Brief description of this template..."
                rows={2}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-stc-purple-100 focus:border-stc-purple-500 resize-none"
              />
            </div>

            {/* Type */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Template Type
              </label>
              <div className="flex gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="templateType"
                    value="PERSONAL"
                    checked={saveType === 'PERSONAL'}
                    onChange={() => setSaveType('PERSONAL')}
                    className="text-stc-purple-500 focus:ring-stc-purple-500"
                  />
                  <span className="text-sm">Personal (only me)</span>
                </label>
                {projectId && (
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="templateType"
                      value="TEAM"
                      checked={saveType === 'TEAM'}
                      onChange={() => setSaveType('TEAM')}
                      className="text-stc-purple-500 focus:ring-stc-purple-500"
                    />
                    <span className="text-sm">Team (project members)</span>
                  </label>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowSaveDialog(false);
                  setSaveName('');
                  setSaveDescription('');
                }}
                disabled={saving}
                className="px-4 py-2 text-neutral-700 hover:bg-neutral-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || !saveName.trim()}
                className="px-4 py-2 bg-stc-purple-500 text-white rounded-lg hover:bg-stc-purple-600 disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Template'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default TemplatePanel;
