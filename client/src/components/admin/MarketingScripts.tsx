import { useState, useEffect, useCallback } from 'react';

const API_BASE = '/api/marketing';

type Insight = {
  id: string;
  hookTheme: string;
  messagingAngle: string;
  audienceSignal: string;
  roas: number;
  realizedRevenue: number;
  proofPoints: string[];
};

type Creator = {
  id: string;
  name: string;
  tiktokHandle: string;
  ratePerVideo: number;
  promoCode: string | null;
  status: string;
  _count: { briefs: number; videos: number };
};

type Brief = {
  id: string;
  creatorId: string | null;
  creator: Creator | null;
};

type Script = {
  id: string;
  persona: string;
  format: string;
  hook: string;
  body: string;
  cta: string;
  hashtags: string[];
  textOverlaySuggestion: string | null;
  settingSuggestion: string | null;
  propsSuggestion: string | null;
  toneSuggestion: string | null;
  durationTarget: number;
  status: string;
  createdAt: string;
  insight: Insight | null;
  briefs: Brief[];
};

type Video = {
  id: string;
  tiktokUrl: string | null;
  viewCount: number;
  likeCount: number;
  shareCount: number;
  commentCount: number;
  saveCount: number;
  linkClicks: number;
  leadsAttributed: number;
  performanceScore: number | null;
  status: string;
  createdAt: string;
  creator: { name: string; tiktokHandle: string };
  brief: { script: { hook: string; persona: string } };
};

type Stats = {
  scripts: { total: number; pendingReview: number; approved: number; briefed: number };
  videos: { total: number };
  creators: { total: number; active: number };
};

const PERSONA_LABELS: Record<string, string> = {
  CONVERTED_PARENT: 'Converted Parent',
  SKEPTICAL_PARENT: 'Skeptical Parent',
  COMPARISON_PARENT: 'Comparison Parent',
};

const STATUS_COLORS: Record<string, string> = {
  PENDING_REVIEW: 'bg-stc-yellow/15 text-neutral-700',
  APPROVED: 'bg-stc-green/15 text-stc-green',
  SKIPPED: 'bg-neutral-100 text-neutral-500',
  BRIEFED: 'bg-stc-blue/15 text-stc-navy',
  FILMED: 'bg-stc-purple-100 text-stc-purple-700',
  POSTED: 'bg-stc-navy/15 text-stc-navy',
};

type SubTab = 'scripts' | 'creators' | 'videos' | 'insights';

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options?.headers },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export default function MarketingScripts() {
  const [subTab, setSubTab] = useState<SubTab>('scripts');
  const [scripts, setScripts] = useState<Script[]>([]);
  const [creators, setCreators] = useState<Creator[]>([]);
  const [videos, setVideos] = useState<Video[]>([]);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [filter, setFilter] = useState('PENDING_REVIEW');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [skipReason, setSkipReason] = useState('');

  // Creator form
  const [showCreatorForm, setShowCreatorForm] = useState(false);
  const [creatorForm, setCreatorForm] = useState({ name: '', tiktokHandle: '', email: '', paymentEmail: '', ratePerVideo: '17.50', promoCode: '', audienceType: '', notes: '' });

  const fetchScripts = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchJson<{ scripts: Script[] }>(`${API_BASE}/scripts?status=${filter}&limit=30`);
      setScripts(data.scripts || []);
    } catch (err) {
      console.error('Failed to fetch scripts:', err);
    }
    setLoading(false);
  }, [filter]);

  const fetchStats = useCallback(async () => {
    try {
      const data = await fetchJson<Stats>(`${API_BASE}/stats`);
      setStats(data);
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    if (subTab === 'scripts') fetchScripts();
  }, [subTab, fetchScripts]);

  useEffect(() => {
    if (subTab === 'creators') {
      fetchJson<Creator[]>(`${API_BASE}/creators`).then(setCreators).catch(console.error);
    }
    if (subTab === 'videos') {
      fetchJson<Video[]>(`${API_BASE}/videos`).then(setVideos).catch(console.error);
    }
    if (subTab === 'insights') {
      fetchJson<Insight[]>(`${API_BASE}/insights`).then(setInsights).catch(console.error);
    }
  }, [subTab]);

  async function updateStatus(id: string, status: string, reason?: string) {
    await fetchJson(`${API_BASE}/scripts/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status, skippedReason: reason }),
    });
    setSkipReason('');
    fetchScripts();
    fetchStats();
  }

  async function generateBrief(scriptId: string, creatorId?: string) {
    const data = await fetchJson<{ briefUrl: string }>(`${API_BASE}/scripts/${scriptId}/brief`, {
      method: 'POST',
      body: JSON.stringify({ creatorId }),
    });
    window.open(data.briefUrl, '_blank');
    fetchScripts();
    fetchStats();
  }

  async function addCreator() {
    await fetchJson(`${API_BASE}/creators`, {
      method: 'POST',
      body: JSON.stringify({
        ...creatorForm,
        ratePerVideo: parseFloat(creatorForm.ratePerVideo),
        promoCode: creatorForm.promoCode || null,
      }),
    });
    setShowCreatorForm(false);
    setCreatorForm({ name: '', tiktokHandle: '', email: '', paymentEmail: '', ratePerVideo: '17.50', promoCode: '', audienceType: '', notes: '' });
    const data = await fetchJson<Creator[]>(`${API_BASE}/creators`);
    setCreators(data);
    fetchStats();
  }

  return (
    <div>
      {/* Stats bar */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            { label: 'Pending Review', value: stats.scripts.pendingReview, color: 'text-stc-yellow' },
            { label: 'Approved', value: stats.scripts.approved, color: 'text-stc-green' },
            { label: 'Briefed', value: stats.scripts.briefed, color: 'text-stc-blue' },
            { label: 'Active Creators', value: stats.creators.active, color: 'text-stc-purple-600' },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-xl border border-neutral-200 p-4">
              <p className="text-xs text-neutral-500">{s.label}</p>
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Sub-tabs */}
      <div className="flex gap-6 border-b border-neutral-200 -mb-px mb-6">
        {(['scripts', 'creators', 'videos', 'insights'] as SubTab[]).map(t => (
          <button
            key={t}
            onClick={() => setSubTab(t)}
            className={`px-1 py-3 text-sm font-medium border-b-2 transition-colors duration-200 min-h-[44px] capitalize ${
              subTab === t ? 'border-stc-purple-500 text-stc-purple-500' : 'border-transparent text-neutral-500 hover:text-neutral-700 hover:border-neutral-300'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Scripts tab */}
      {subTab === 'scripts' && (
        <>
          <div className="flex gap-2 mb-4 flex-wrap">
            {['PENDING_REVIEW', 'APPROVED', 'BRIEFED', 'SKIPPED', 'POSTED'].map(s => (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors min-h-[44px]
                  ${filter === s ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'}`}
              >
                {s.replace(/_/g, ' ')}
              </button>
            ))}
          </div>

          {loading && <p className="text-neutral-400 text-sm py-8 text-center">Loading scripts...</p>}

          {!loading && scripts.length === 0 && (
            <p className="text-neutral-400 text-sm py-8 text-center">No scripts with status "{filter.replace(/_/g, ' ')}"</p>
          )}

          <div className="space-y-3">
            {scripts.map(script => (
              <div key={script.id} className="bg-white border border-neutral-200 rounded-xl overflow-hidden">
                {/* Header */}
                <button
                  className="flex items-center justify-between p-4 w-full text-left hover:bg-neutral-50 transition-colors min-h-[44px]"
                  onClick={() => setExpanded(expanded === script.id ? null : script.id)}
                >
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[script.status] || 'bg-neutral-100'}`}>
                      {script.status.replace(/_/g, ' ')}
                    </span>
                    <span className="text-xs text-neutral-500 bg-neutral-100 px-2 py-0.5 rounded">
                      {PERSONA_LABELS[script.persona] || script.persona}
                    </span>
                    <span className="text-xs text-neutral-400">{script.format.replace(/_/g, ' ')}</span>
                    <span className="text-sm text-neutral-700 font-medium truncate max-w-[300px]">
                      "{script.hook.substring(0, 60)}{script.hook.length > 60 ? '...' : ''}"
                    </span>
                  </div>
                  <span className="text-neutral-400 text-xs flex-shrink-0 ml-2">
                    {new Date(script.createdAt).toLocaleDateString()}
                  </span>
                </button>

                {/* Expanded detail */}
                {expanded === script.id && (
                  <div className="border-t border-neutral-100 p-4 space-y-4">
                    {/* Insight badge */}
                    {script.insight && (
                      <div className="bg-stc-blue/10 rounded-lg p-3 text-xs text-stc-navy">
                        <strong>Insight:</strong> {script.insight.hookTheme}
                        <span className="ml-2">ROAS {script.insight.roas.toFixed(1)}x</span>
                        <span className="ml-2">${script.insight.realizedRevenue.toFixed(0)} revenue</span>
                      </div>
                    )}

                    {/* Script content */}
                    <div>
                      <p className="text-xs text-neutral-400 uppercase tracking-wide mb-1">Hook (first 3s)</p>
                      <p className="font-semibold text-neutral-900 text-lg leading-snug">"{script.hook}"</p>
                    </div>

                    {script.textOverlaySuggestion && (
                      <div className="bg-stc-yellow/10 rounded-lg p-3 text-sm">
                        <span className="text-xs text-stc-yellow uppercase tracking-wide font-medium">Text Overlay</span>
                        <p className="text-neutral-700 font-medium mt-1">{script.textOverlaySuggestion}</p>
                      </div>
                    )}

                    <div>
                      <p className="text-xs text-neutral-400 uppercase tracking-wide mb-1">Body</p>
                      <p className="text-neutral-700 whitespace-pre-wrap leading-relaxed">{script.body}</p>
                    </div>
                    <div>
                      <p className="text-xs text-neutral-400 uppercase tracking-wide mb-1">CTA</p>
                      <p className="text-neutral-700">"{script.cta}"</p>
                    </div>

                    {/* Filming direction */}
                    {(script.settingSuggestion || script.propsSuggestion || script.toneSuggestion) && (
                      <div className="bg-neutral-50 rounded-lg p-3 space-y-1 text-sm text-neutral-600">
                        {script.settingSuggestion && <p>📍 {script.settingSuggestion}</p>}
                        {script.propsSuggestion && <p>🎬 {script.propsSuggestion}</p>}
                        {script.toneSuggestion && <p>🎙️ {script.toneSuggestion}</p>}
                        <p className="text-xs text-neutral-400">~{script.durationTarget}s target</p>
                      </div>
                    )}

                    {/* Hashtags */}
                    <div className="flex flex-wrap gap-2">
                      {script.hashtags.map((h, i) => (
                        <span key={i} className="bg-neutral-900 text-white px-2.5 py-1 rounded-full text-xs">
                          #{h.replace(/^#/, '')}
                        </span>
                      ))}
                      <span className="bg-stc-purple text-white px-2.5 py-1 rounded-full text-xs">#acmecreative</span>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-3 pt-2 border-t border-neutral-100">
                      {script.status === 'PENDING_REVIEW' && (
                        <>
                          <button
                            onClick={() => updateStatus(script.id, 'APPROVED')}
                            className="px-4 py-2 bg-stc-green text-white rounded-lg text-sm font-medium hover:bg-stc-green transition-colors min-h-[44px]"
                          >
                            Approve
                          </button>
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              placeholder="Skip reason (optional)"
                              value={skipReason}
                              onChange={e => setSkipReason(e.target.value)}
                              className="px-3 py-2 border border-neutral-200 rounded-lg text-sm min-h-[44px]"
                            />
                            <button
                              onClick={() => updateStatus(script.id, 'SKIPPED', skipReason)}
                              className="px-4 py-2 bg-neutral-200 text-neutral-700 rounded-lg text-sm font-medium hover:bg-neutral-300 transition-colors min-h-[44px]"
                            >
                              Skip
                            </button>
                          </div>
                        </>
                      )}
                      {script.status === 'APPROVED' && (
                        <div className="flex items-center gap-3">
                          <select
                            id={`creator-${script.id}`}
                            className="px-3 py-2 border border-neutral-200 rounded-lg text-sm min-h-[44px]"
                            defaultValue=""
                            onChange={() => {}}
                          >
                            <option value="">No specific creator</option>
                            {creators.map(c => (
                              <option key={c.id} value={c.id}>
                                {c.name} (@{c.tiktokHandle})
                              </option>
                            ))}
                          </select>
                          <button
                            onClick={() => {
                              const select = document.getElementById(`creator-${script.id}`) as HTMLSelectElement;
                              generateBrief(script.id, select?.value || undefined);
                            }}
                            className="px-4 py-2 bg-stc-navy text-white rounded-lg text-sm font-medium hover:bg-stc-navy transition-colors min-h-[44px]"
                          >
                            Generate Brief
                          </button>
                        </div>
                      )}
                      {script.briefs.length > 0 && (
                        <div className="flex gap-2">
                          {script.briefs.map(b => (
                            <a
                              key={b.id}
                              href={`${API_BASE}/briefs/${b.id}/html`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-3 py-2 bg-neutral-100 text-neutral-700 rounded-lg text-xs hover:bg-neutral-200 transition-colors min-h-[44px] flex items-center"
                            >
                              View Brief{b.creator ? ` (${b.creator.name})` : ''}
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {/* Creators tab */}
      {subTab === 'creators' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-neutral-500">{creators.length} creator{creators.length !== 1 ? 's' : ''}</p>
            <button
              onClick={() => setShowCreatorForm(!showCreatorForm)}
              className="px-4 py-2 bg-stc-purple text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity min-h-[44px]"
            >
              {showCreatorForm ? 'Cancel' : 'Add Creator'}
            </button>
          </div>

          {showCreatorForm && (
            <div className="bg-white border border-neutral-200 rounded-xl p-4 mb-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <input placeholder="Name" value={creatorForm.name} onChange={e => setCreatorForm(p => ({ ...p, name: e.target.value }))} className="px-3 py-2 border border-neutral-200 rounded-lg text-sm min-h-[44px]" />
                <input placeholder="@tiktokhandle" value={creatorForm.tiktokHandle} onChange={e => setCreatorForm(p => ({ ...p, tiktokHandle: e.target.value }))} className="px-3 py-2 border border-neutral-200 rounded-lg text-sm min-h-[44px]" />
                <input placeholder="Email" value={creatorForm.email} onChange={e => setCreatorForm(p => ({ ...p, email: e.target.value }))} className="px-3 py-2 border border-neutral-200 rounded-lg text-sm min-h-[44px]" />
                <input placeholder="Payment email (Venmo/PayPal)" value={creatorForm.paymentEmail} onChange={e => setCreatorForm(p => ({ ...p, paymentEmail: e.target.value }))} className="px-3 py-2 border border-neutral-200 rounded-lg text-sm min-h-[44px]" />
                <input placeholder="Rate per video" type="number" step="0.50" value={creatorForm.ratePerVideo} onChange={e => setCreatorForm(p => ({ ...p, ratePerVideo: e.target.value }))} className="px-3 py-2 border border-neutral-200 rounded-lg text-sm min-h-[44px]" />
                <input placeholder="Promo code (e.g. SARAH10)" value={creatorForm.promoCode} onChange={e => setCreatorForm(p => ({ ...p, promoCode: e.target.value }))} className="px-3 py-2 border border-neutral-200 rounded-lg text-sm min-h-[44px]" />
                <input placeholder="Audience type (e.g. moms 28-40)" value={creatorForm.audienceType} onChange={e => setCreatorForm(p => ({ ...p, audienceType: e.target.value }))} className="px-3 py-2 border border-neutral-200 rounded-lg text-sm min-h-[44px]" />
                <input placeholder="Notes" value={creatorForm.notes} onChange={e => setCreatorForm(p => ({ ...p, notes: e.target.value }))} className="px-3 py-2 border border-neutral-200 rounded-lg text-sm min-h-[44px]" />
              </div>
              <button
                onClick={addCreator}
                disabled={!creatorForm.name || !creatorForm.tiktokHandle}
                className="px-4 py-2 bg-stc-green text-white rounded-lg text-sm font-medium hover:bg-stc-green transition-colors disabled:opacity-50 min-h-[44px]"
              >
                Add Creator
              </button>
            </div>
          )}

          <div className="space-y-3">
            {creators.map(creator => (
              <div key={creator.id} className="bg-white border border-neutral-200 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-neutral-900">{creator.name}</span>
                      <span className="text-sm text-neutral-500">@{creator.tiktokHandle}</span>
                      {creator.promoCode && (
                        <span className="text-xs bg-stc-purple-100 text-stc-purple-700 px-2 py-0.5 rounded">{creator.promoCode}</span>
                      )}
                    </div>
                    <p className="text-xs text-neutral-400 mt-1">
                      ${creator.ratePerVideo.toFixed(2)}/video · {creator._count.briefs} briefs · {creator._count.videos} videos
                    </p>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                    creator.status === 'ACTIVE' ? 'bg-stc-green/15 text-stc-green' :
                    creator.status === 'OUTREACH' ? 'bg-stc-yellow/15 text-stc-yellow' :
                    'bg-neutral-100 text-neutral-500'
                  }`}>
                    {creator.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Videos tab */}
      {subTab === 'videos' && (
        <div>
          {videos.length === 0 ? (
            <p className="text-neutral-400 text-sm py-8 text-center">No videos tracked yet</p>
          ) : (
            <div className="space-y-3">
              {videos.map(video => (
                <div key={video.id} className="bg-white border border-neutral-200 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-neutral-900 text-sm">{video.creator.name}</span>
                      <span className="text-xs text-neutral-400">@{video.creator.tiktokHandle}</span>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[video.status] || 'bg-neutral-100'}`}>
                        {video.status}
                      </span>
                    </div>
                    {video.performanceScore !== null && (
                      <span className="text-sm font-bold text-stc-purple">{video.performanceScore.toFixed(1)} pts</span>
                    )}
                  </div>
                  <p className="text-xs text-neutral-500 mb-2">
                    Hook: "{video.brief.script.hook.substring(0, 80)}..."
                  </p>
                  <div className="flex gap-4 text-xs text-neutral-500">
                    <span>{video.viewCount.toLocaleString()} views</span>
                    <span>{video.saveCount} saves</span>
                    <span>{video.likeCount} likes</span>
                    <span>{video.shareCount} shares</span>
                    <span>{video.linkClicks} clicks</span>
                    <span>{video.leadsAttributed} leads</span>
                  </div>
                  {video.tiktokUrl && (
                    <a href={video.tiktokUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-stc-blue hover:underline mt-1 inline-block">
                      View on TikTok
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Insights tab */}
      {subTab === 'insights' && (
        <div>
          <p className="text-sm text-neutral-500 mb-4">Active marketing insights extracted from OpsHub paid ads data</p>
          {insights.length === 0 ? (
            <p className="text-neutral-400 text-sm py-8 text-center">
              No insights extracted yet. Run <code className="bg-neutral-100 px-1 rounded">npm run insights:extract</code> to populate.
            </p>
          ) : (
            <div className="space-y-3">
              {insights.map(insight => (
                <div key={insight.id} className="bg-white border border-neutral-200 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-medium text-neutral-900 text-sm">{insight.hookTheme}</p>
                    <span className="text-xs text-stc-green font-medium">{insight.roas.toFixed(1)}x ROAS</span>
                  </div>
                  <p className="text-xs text-neutral-500 mb-1">
                    <strong>Angle:</strong> {insight.messagingAngle}
                  </p>
                  <p className="text-xs text-neutral-500 mb-2">
                    <strong>Audience:</strong> {insight.audienceSignal}
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {insight.proofPoints.map((p, i) => (
                      <span key={i} className="text-xs bg-stc-green/10 text-stc-green px-2 py-0.5 rounded">{p}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
