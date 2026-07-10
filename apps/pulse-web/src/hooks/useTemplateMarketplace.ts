import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchJson, postJson } from '../lib/api';

export type TemplateCategory = 'infrastructure' | 'application' | 'security' | 'cost' | 'custom';

export type DashboardTemplate = {
  id: string;
  name: string;
  description: string;
  category: TemplateCategory;
  author: string;
  team: string;
  panels: Array<{ type: string; title: string; config: Record<string, unknown> }>;
  createdAt: string;
  updatedAt: string;
  downloads: number;
  rating: number;
  isFavorite: boolean;
  isTeamShared: boolean;
};

export type TemplatePreview = {
  id: string;
  name: string;
  description: string;
  panels: Array<{ type: string; title: string; config: Record<string, unknown> }>;
};

const CATEGORY_COLORS: Record<TemplateCategory, { bg: string; text: string; border: string }> = {
  infrastructure: { bg: 'rgba(96,165,250,0.12)', text: '#60a5fa', border: 'rgba(96,165,250,0.3)' },
  application: { bg: 'rgba(52,211,153,0.12)', text: '#34d399', border: 'rgba(52,211,153,0.3)' },
  security: { bg: 'rgba(239,68,68,0.12)', text: '#ef4444', border: 'rgba(239,68,68,0.3)' },
  cost: { bg: 'rgba(251,191,36,0.12)', text: '#fbbf24', border: 'rgba(251,191,36,0.3)' },
  custom: { bg: 'rgba(168,85,247,0.12)', text: '#a855f7', border: 'rgba(168,85,247,0.3)' },
};

export function useTemplateMarketplace() {
  const [categoryFilter, setCategoryFilter] = useState<TemplateCategory | 'all'>('all');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const templatesQuery = useQuery({
    queryKey: ['templates', categoryFilter],
    queryFn: () => fetchJson<DashboardTemplate[]>(`/api/templates?category=${categoryFilter}`),
    retry: 2,
    retryDelay: 1000,
  });

  const favoritesCountQuery = useQuery({
    queryKey: ['template-favorites-count'],
    queryFn: () => fetchJson<{ count: number }>('/api/templates/favorites/count'),
    retry: 2,
    retryDelay: 1000,
  });

  const favoriteMutation = useMutation({
    mutationFn: (id: string) => postJson(`/api/templates/${id}/favorite`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      queryClient.invalidateQueries({ queryKey: ['template-favorites-count'] });
    },
  });

  const downloadMutation = useMutation({
    mutationFn: (id: string) => postJson(`/api/templates/${id}/download`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
    },
  });

  const createMutation = useMutation({
    mutationFn: (template: Omit<DashboardTemplate, 'id' | 'createdAt' | 'updatedAt' | 'downloads' | 'rating' | 'isFavorite'>) =>
      postJson('/api/templates', template),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
    },
  });

  const shareMutation = useMutation({
    mutationFn: ({ id, team }: { id: string; team: string }) => postJson(`/api/templates/${id}/share`, { team }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
    },
  });

  const categoriesQuery = useQuery({
    queryKey: ['template-categories'],
    queryFn: () => fetchJson<TemplateCategory[]>('/api/templates/categories'),
    retry: 2,
    retryDelay: 1000,
  });

  const templates = templatesQuery.data ?? [];
  const selectedTemplate = selectedTemplateId ? templates.find((t) => t.id === selectedTemplateId) : null;

  return {
    templates,
    selectedTemplate,
    categories: categoriesQuery.data ?? [],
    favoritesCount: favoritesCountQuery.data?.count ?? 0,
    categoryFilter,
    isLoading: templatesQuery.isLoading || categoriesQuery.isLoading,
    isError: templatesQuery.isError || categoriesQuery.isError,
    setCategoryFilter,
    setSelectedTemplateId,
    toggleFavorite: favoriteMutation.mutate,
    downloadTemplate: downloadMutation.mutate,
    createTemplate: createMutation.mutate,
    shareTemplate: shareMutation.mutate,
    CATEGORY_COLORS,
  };
}
