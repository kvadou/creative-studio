import { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import {
  UserGroupIcon,
  SparklesIcon,
  CubeTransparentIcon,
  MegaphoneIcon,
} from '@heroicons/react/24/outline';
import type { StudioUser, UserRole } from '../../lib/types';
import { getUsers, updateUserRole } from '../../lib/api';
import PipelineDashboard from './PipelineDashboard';

const EmbeddingsExplorer = lazy(() => import('./EmbeddingsExplorer'));
const MarketingScripts = lazy(() => import('./MarketingScripts'));

type AdminTab = 'users' | 'pipeline' | 'embeddings' | 'marketing';

interface AdminPageProps {
  currentUserEmail?: string;
}

export default function AdminPage({ currentUserEmail }: AdminPageProps) {
  const [activeTab, setActiveTab] = useState<AdminTab>('users');
  const [users, setUsers] = useState<StudioUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    getUsers()
      .then(setUsers)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleRoleChange = useCallback(async (userId: string, newRole: UserRole) => {
    setUpdatingId(userId);
    try {
      const updated = await updateUserRole(userId, newRole);
      setUsers(prev => prev.map(u => u.id === userId ? updated : u));
    } catch (err) {
      console.error('Failed to update role:', err);
    } finally {
      setUpdatingId(null);
    }
  }, []);

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Never';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    });
  };

  const getRoleBadgeColor = (role: UserRole) => {
    switch (role) {
      case 'ADMIN': return 'bg-stc-purple-100 text-stc-purple-700';
      case 'MEMBER': return 'bg-stc-blue/10 text-stc-navy';
      case 'VIEWER': return 'bg-neutral-100 text-neutral-600';
    }
  };

  const tabs: { key: AdminTab; label: string; icon: React.ComponentType<React.SVGProps<SVGSVGElement>> }[] = [
    { key: 'users', label: 'Users', icon: UserGroupIcon },
    { key: 'pipeline', label: 'AI Pipeline', icon: SparklesIcon },
    { key: 'embeddings', label: 'Embeddings', icon: CubeTransparentIcon },
    { key: 'marketing', label: 'Marketing', icon: MegaphoneIcon },
  ];

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        {/* Header with tabs */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-neutral-900 mb-4">Admin</h1>
          <div className="flex gap-6 border-b border-neutral-200 -mb-px">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex items-center gap-2 px-1 py-3 text-sm font-medium border-b-2 transition-colors duration-200 min-h-[44px] ${
                    activeTab === tab.key
                      ? 'border-stc-purple-500 text-stc-purple-500'
                      : 'border-transparent text-neutral-500 hover:text-neutral-700 hover:border-neutral-300'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'users' && (
          <div className="max-w-3xl">
            <div className="mb-4">
              <p className="text-sm text-neutral-500">
                Manage access levels for Acme Creative Studio users
              </p>
            </div>

            <div className="text-sm text-neutral-500 mb-4">
              {loading ? '...' : `${users.length} user${users.length !== 1 ? 's' : ''}`}
            </div>

            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="bg-white rounded-xl border border-neutral-200 p-5 animate-pulse">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-neutral-200" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 bg-neutral-200 rounded w-1/3" />
                        <div className="h-3 bg-neutral-200 rounded w-1/2" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {users.map(user => {
                  const isSelf = user.email === currentUserEmail;
                  const isUpdating = updatingId === user.id;

                  return (
                    <div
                      key={user.id}
                      className={`bg-white rounded-xl border border-neutral-200 p-5 transition-all duration-200 ${
                        isSelf ? 'ring-1 ring-stc-purple-200' : ''
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                        <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
                          {user.picture ? (
                            <img
                              src={user.picture}
                              alt={user.name}
                              className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-stc-purple-100 flex items-center justify-center text-sm font-semibold text-stc-purple-700 flex-shrink-0">
                              {getInitials(user.name)}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-neutral-900 truncate">{user.name}</span>
                              {isSelf && (
                                <span className="text-xs text-stc-purple-600 font-medium">(you)</span>
                              )}
                            </div>
                            <p className="text-sm text-neutral-500 truncate">{user.email}</p>
                            <p className="text-xs text-neutral-400 mt-0.5">
                              Last login: {formatDate(user.lastLoginAt)}
                            </p>
                          </div>
                        </div>
                        <div className="flex-shrink-0 sm:ml-0 ml-[52px]">
                          <select
                            value={user.role}
                            onChange={(e) => handleRoleChange(user.id, e.target.value as UserRole)}
                            disabled={isSelf || isUpdating}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors duration-200 min-h-[44px] ${
                              isSelf
                                ? 'bg-neutral-50 text-neutral-400 border-neutral-200 cursor-not-allowed'
                                : `${getRoleBadgeColor(user.role)} border-transparent cursor-pointer hover:border-neutral-300`
                            } ${isUpdating ? 'opacity-50' : ''}`}
                          >
                            <option value="ADMIN">Admin</option>
                            <option value="MEMBER">Member</option>
                            <option value="VIEWER">Viewer</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {users.length === 0 && (
                  <div className="text-center py-12 text-neutral-400">
                    <p className="text-sm">No users found. Users will appear here after they sign in.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'pipeline' && <PipelineDashboard />}

        {activeTab === 'marketing' && (
          <Suspense fallback={<div className="text-center py-12 text-neutral-400">Loading...</div>}>
            <MarketingScripts />
          </Suspense>
        )}

        {activeTab === 'embeddings' && (
          <Suspense fallback={<div className="text-center py-12 text-neutral-400">Loading...</div>}>
            <EmbeddingsExplorer />
          </Suspense>
        )}
      </div>
    </div>
  );
}
