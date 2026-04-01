import { useState, useEffect } from 'react';
import { XMarkIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import type { Project, ProjectMember, ProjectRole } from '../lib/types';
import { getProjectMembers, inviteToProject, removeFromProject, updateProject, deleteProject } from '../lib/api';

interface ProjectSettingsPanelProps {
  project: Project;
  isOpen: boolean;
  onClose: () => void;
  onProjectUpdate: (project: Project) => void;
  onProjectDelete: () => void;
}

export default function ProjectSettingsPanel({
  project,
  isOpen,
  onClose,
  onProjectUpdate,
  onProjectDelete,
}: ProjectSettingsPanelProps) {
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [name, setName] = useState(project.name);
  const [instructions, setInstructions] = useState(project.instructions || '');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<ProjectRole>('EDITOR');
  const [isSaving, setIsSaving] = useState(false);
  const [isInviting, setIsInviting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Load members when panel opens
  useEffect(() => {
    if (isOpen) {
      setName(project.name);
      setInstructions(project.instructions || '');
      loadMembers();
    }
  }, [isOpen, project.id]);

  const loadMembers = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getProjectMembers(project.id);
      setMembers(data);
    } catch (err) {
      setError('Failed to load members');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!project.isOwner) return;
    setIsSaving(true);
    setError(null);
    try {
      const updated = await updateProject(project.id, {
        name: name.trim() || project.name,
        instructions: instructions.trim() || null,
      });
      onProjectUpdate(updated);
    } catch (err: any) {
      setError(err.message || 'Failed to save');
    } finally {
      setIsSaving(false);
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim() || !project.isOwner) return;

    setIsInviting(true);
    setError(null);
    try {
      const newMember = await inviteToProject(project.id, inviteEmail.trim(), inviteRole);
      setMembers([...members, newMember]);
      setInviteEmail('');
    } catch (err: any) {
      setError(err.message || 'Failed to invite');
    } finally {
      setIsInviting(false);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!project.isOwner) return;
    try {
      await removeFromProject(project.id, userId);
      setMembers(members.filter((m) => m.userId !== userId));
    } catch (err: any) {
      setError(err.message || 'Failed to remove member');
    }
  };

  const handleDelete = async () => {
    try {
      await deleteProject(project.id);
      onProjectDelete();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to delete project');
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-xl z-50 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-neutral-200">
          <h2 className="text-lg font-semibold text-neutral-900">Project Settings</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-neutral-100 rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            <XMarkIcon className="w-5 h-5 text-neutral-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {error && (
            <div className="p-3 bg-stc-pink/10 border border-stc-pink/20 rounded-lg text-stc-pink text-sm">
              {error}
            </div>
          )}

          {/* Name & Instructions (Owners only) */}
          {project.isOwner ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Project Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 min-h-[44px] border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-stc-purple-100 focus:border-stc-purple-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Project Instructions
                </label>
                <p className="text-xs text-neutral-500 mb-2">
                  These instructions will be included with every chat in this project.
                </p>
                <textarea
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  rows={4}
                  placeholder="e.g., Focus on adaptations for Singapore market. Use British spelling. Consider local cultural sensitivities..."
                  className="w-full px-3 py-2 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-stc-purple-100 focus:border-stc-purple-500 resize-none"
                />
              </div>

              <button
                onClick={handleSave}
                disabled={isSaving}
                className="w-full py-2 min-h-[44px] bg-stc-purple-500 hover:bg-stc-purple-600 disabled:bg-stc-purple-300 text-white font-medium rounded-lg transition-colors"
              >
                {isSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          ) : (
            <div className="p-4 bg-neutral-50 rounded-lg">
              <h3 className="font-medium text-neutral-900">{project.name}</h3>
              {project.instructions && (
                <p className="mt-2 text-sm text-neutral-600">{project.instructions}</p>
              )}
              <p className="mt-2 text-xs text-neutral-400">
                You have {project.role.toLowerCase()} access to this project.
              </p>
            </div>
          )}

          {/* Members Section */}
          <div>
            <h3 className="text-sm font-semibold text-neutral-900 mb-3">Team Members</h3>

            {isLoading ? (
              <div className="flex items-center justify-center py-4">
                <ArrowPathIcon className="animate-spin h-5 w-5 text-stc-purple-500" />
              </div>
            ) : (
              <div className="space-y-2">
                {members.map((member) => (
                  <div
                    key={member.userId}
                    className="flex items-center justify-between p-3 bg-neutral-50 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-stc-purple-100 rounded-full flex items-center justify-center">
                        <span className="text-sm font-medium text-stc-purple-600">
                          {member.email.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-neutral-900">{member.email}</p>
                        <p className="text-xs text-neutral-500">
                          {member.isOriginalOwner ? 'Owner' : member.role}
                        </p>
                      </div>
                    </div>

                    {project.isOwner && !member.isOriginalOwner && (
                      <button
                        onClick={() => handleRemoveMember(member.userId)}
                        className="p-2 text-neutral-400 hover:text-stc-pink hover:bg-stc-pink/10 rounded-lg transition-colors duration-200"
                        aria-label="Remove member"
                      >
                        <XMarkIcon className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Invite Form (Owners only) */}
            {project.isOwner && (
              <form onSubmit={handleInvite} className="mt-4 p-4 border border-dashed border-neutral-300 rounded-lg">
                <h4 className="text-sm font-medium text-neutral-700 mb-3">Invite Team Member</h4>
                <div className="space-y-3">
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="colleague@acmecreative.com"
                    className="w-full px-3 py-2 min-h-[44px] border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-stc-purple-100 focus:border-stc-purple-500 text-sm"
                  />
                  <div className="flex gap-2">
                    <select
                      value={inviteRole}
                      onChange={(e) => setInviteRole(e.target.value as ProjectRole)}
                      className="flex-1 px-3 py-2 min-h-[44px] border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-stc-purple-100 focus:border-stc-purple-500 text-sm bg-white"
                    >
                      <option value="EDITOR">Editor</option>
                      <option value="OWNER">Owner</option>
                    </select>
                    <button
                      type="submit"
                      disabled={isInviting || !inviteEmail.trim()}
                      className="px-4 py-2 min-h-[44px] bg-stc-purple-500 hover:bg-stc-purple-600 disabled:bg-stc-purple-300 text-white font-medium rounded-lg transition-colors text-sm"
                    >
                      {isInviting ? '...' : 'Invite'}
                    </button>
                  </div>
                  <p className="text-xs text-neutral-500">
                    Only @acmecreative.com emails can be invited.
                  </p>
                </div>
              </form>
            )}
          </div>

          {/* Danger Zone (Owners only) */}
          {project.isOwner && (
            <div className="border-t border-neutral-200 pt-6">
              <h3 className="text-sm font-semibold text-stc-pink mb-3">Danger Zone</h3>
              {showDeleteConfirm ? (
                <div className="p-4 bg-stc-pink/10 border border-stc-pink/20 rounded-lg space-y-3">
                  <p className="text-sm text-stc-pink">
                    Are you sure you want to delete this project? This action cannot be undone.
                    Conversations will be moved to "All Chats".
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowDeleteConfirm(false)}
                      className="flex-1 py-2 min-h-[44px] border border-neutral-300 text-neutral-700 font-medium rounded-lg hover:bg-neutral-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleDelete}
                      className="flex-1 py-2 min-h-[44px] bg-stc-pink hover:bg-stc-pink text-white font-medium rounded-lg transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="w-full py-2 min-h-[44px] border border-stc-pink/30 text-stc-pink font-medium rounded-lg hover:bg-stc-pink/10 transition-colors"
                >
                  Delete Project
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
