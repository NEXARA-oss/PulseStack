import { useState } from 'react';
import { useTemplateMarketplace } from '../hooks/useTemplateMarketplace';

export function TemplateMarketplaceDashboard() {
  const {
    templates,
    selectedTemplate,
    categories,
    favoritesCount,
    categoryFilter,
    isLoading,
    isError,
    setCategoryFilter,
    setSelectedTemplateId,
    toggleFavorite,
    downloadTemplate,
    createTemplate,
    shareTemplate,
    CATEGORY_COLORS,
  } = useTemplateMarketplace();

  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newTeam, setNewTeam] = useState('platform');

  if (isError) {
    return (
      <div className="rounded-xl border border-rose-400/20 bg-rose-500/10 p-6 text-center text-rose-200">
        Failed to load templates.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          Template Marketplace
        </h3>
        <span className="bg-cyan/15 text-cyan border border-cyan/30 px-3 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider">
          Dashboard Templates
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={() => setCategoryFilter('all')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
            categoryFilter === 'all' ? 'bg-cyan/20 text-cyan border border-cyan/30' : 'text-white/60 border border-white/10'
          }`}
        >
          All
        </button>
        {categories.map((c) => (
          <button
            key={c}
            onClick={() => setCategoryFilter(c)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              categoryFilter === c ? 'bg-cyan/20 text-cyan border border-cyan/30' : 'text-white/60 border border-white/10'
            }`}
          >
            {c}
          </button>
        ))}
        <span className="text-xs text-white/40">{favoritesCount} favorites</span>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3">
          {isLoading ? (
            <div className="text-sm text-white/40">Loading templates...</div>
          ) : (
            templates.map((tpl) => (
              <button
                key={tpl.id}
                onClick={() => setSelectedTemplateId(tpl.id)}
                className={`w-full rounded-xl border p-4 text-left transition-colors ${
                  selectedTemplateId === tpl.id ? 'border-cyan bg-cyan/10' : 'border-white/10 bg-white/5 hover:border-white/20'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-semibold text-white">{tpl.name}</span>
                  <span
                    className="text-[10px] uppercase font-mono px-2 py-0.5 rounded border"
                    style={{
                      background: CATEGORY_COLORS[tpl.category].bg,
                      color: CATEGORY_COLORS[tpl.category].text,
                      borderColor: CATEGORY_COLORS[tpl.category].border,
                    }}
                  >
                    {tpl.category}
                  </span>
                </div>
                <div className="mt-1 text-xs text-white/50">{tpl.description}</div>
                <div className="mt-2 flex items-center justify-between text-[10px] text-white/40">
                  <span>{tpl.author} · {tpl.team}</span>
                  <span>{tpl.downloads} downloads · {tpl.panels.length} panels</span>
                </div>
              </button>
            ))
          )}
        </div>

        <div className="rounded-xl border border-white/10 bg-black/20 p-4">
          {selectedTemplate ? (
            <div className="space-y-4">
              <h4 className="font-semibold text-white">{selectedTemplate.name}</h4>
              <p className="text-xs text-white/50">{selectedTemplate.description}</p>
              <div className="space-y-2">
                {selectedTemplate.panels.map((panel, idx) => (
                  <div key={idx} className="rounded-lg border border-white/10 bg-white/5 p-2 text-xs">
                    <div className="font-semibold text-white/70">{panel.title}</div>
                    <div className="text-white/40 font-mono">{panel.type}</div>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => downloadTemplate(selectedTemplate.id)}
                  className="rounded-lg border border-cyan/30 bg-cyan/10 px-3 py-1.5 text-xs font-semibold text-cyan hover:bg-cyan/20 transition"
                >
                  Apply Template
                </button>
                <button
                  onClick={() => toggleFavorite(selectedTemplate.id)}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                    selectedTemplate.isFavorite
                      ? 'border-amber-400/30 bg-amber-400/10 text-amber-300'
                      : 'border-white/10 bg-white/5 text-white/60 hover:border-white/20'
                  }`}
                >
                  {selectedTemplate.isFavorite ? '★ Favorited' : '☆ Favorite'}
                </button>
                <button
                  onClick={() => shareTemplate({ id: selectedTemplate.id, team: 'platform' })}
                  className="rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-3 py-1.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-400/20 transition"
                >
                  Share to Team
                </button>
              </div>
            </div>
          ) : (
            <div className="flex h-[300px] items-center justify-center text-white/40 text-sm">
              Select a template to preview.
            </div>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-black/20 p-4">
        <h4 className="text-sm font-semibold text-white mb-3">Save Current Dashboard as Template</h4>
        <div className="flex flex-wrap gap-3">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Template name"
            className="rounded-lg border border-white/10 bg-black/20 px-3 py-1.5 text-sm text-white placeholder:text-white/30 focus:border-cyan focus:outline-none"
          />
          <input
            type="text"
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            placeholder="Description"
            className="rounded-lg border border-white/10 bg-black/20 px-3 py-1.5 text-sm text-white placeholder:text-white/30 focus:border-cyan focus:outline-none"
          />
          <select
            value={newTeam}
            onChange={(e) => setNewTeam(e.target.value)}
            className="rounded-lg border border-white/10 bg-black/20 px-3 py-1.5 text-sm text-white focus:border-cyan focus:outline-none"
          >
            <option value="platform">Platform</option>
            <option value="security">Security</option>
            <option value="finance">Finance</option>
            <option value="custom">Custom</option>
          </select>
          <button
            onClick={() => {
              if (!newName.trim()) return;
              createTemplate({
                name: newName,
                description: newDesc,
                category: 'custom',
                author: 'current-user',
                team: newTeam,
                panels: [],
                isTeamShared: true,
              });
              setNewName('');
              setNewDesc('');
            }}
            className="rounded-lg border border-cyan/30 bg-cyan/10 px-3 py-1.5 text-xs font-semibold text-cyan hover:bg-cyan/20 transition"
          >
            Save Template
          </button>
        </div>
      </div>
    </div>
  );
}
