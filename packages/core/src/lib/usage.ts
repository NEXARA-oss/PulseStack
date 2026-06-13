import type {
  CostEstimate,
  TokenUsage,
  UsageAttribution,
  UsageMetadata,
} from '@pulsestack/contracts';

export type ModelPricing = {
  inputCostPer1kTokens: number;
  outputCostPer1kTokens: number;
};

export const DEFAULT_MODEL_PRICING: Record<string, ModelPricing> = {
  generic: {
    inputCostPer1kTokens: 0.001,
    outputCostPer1kTokens: 0.002,
  },
  'generic-llm': {
    inputCostPer1kTokens: 0.001,
    outputCostPer1kTokens: 0.002,
  },
};

export function normalizeTokenUsage(input: {
  inputTokens?: unknown;
  outputTokens?: unknown;
  totalTokens?: unknown;
}): Required<TokenUsage> {
  const inputTokens = nonNegativeInteger(input.inputTokens);
  const outputTokens = nonNegativeInteger(input.outputTokens);
  const explicitTotal = nonNegativeInteger(input.totalTokens);
  return {
    inputTokens,
    outputTokens,
    totalTokens: explicitTotal || inputTokens + outputTokens,
  };
}

export function estimateCost(
  model: string | undefined,
  inputTokens: number,
  outputTokens: number,
  pricing: Record<string, ModelPricing> = DEFAULT_MODEL_PRICING,
): Required<CostEstimate> {
  const rates = pricing[model ?? ''] ?? pricing.generic;
  const inputCost = roundCurrency((inputTokens / 1000) * rates.inputCostPer1kTokens);
  const outputCost = roundCurrency((outputTokens / 1000) * rates.outputCostPer1kTokens);
  return {
    inputCost,
    outputCost,
    totalCost: roundCurrency(inputCost + outputCost),
  };
}

export function buildUsageMetadata(args: {
  model?: string;
  tokenUsage: TokenUsage;
  pricing?: Record<string, ModelPricing>;
  attribution?: UsageAttribution;
}): UsageMetadata {
  const usage = normalizeTokenUsage(args.tokenUsage);
  const cost = estimateCost(
    args.model,
    usage.inputTokens,
    usage.outputTokens,
    args.pricing,
  );
  return {
    ...usage,
    ...cost,
    attribution: {
      ...args.attribution,
      ...(args.model ? { model: args.model } : {}),
    },
  };
}

export function aggregateUsage(
  items: Array<UsageMetadata | undefined>,
  attribution?: UsageAttribution,
): UsageMetadata {
  type UsageTotals = {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    inputCost: number;
    outputCost: number;
    totalCost: number;
  };
  const totals = items.reduce(
    (sum: UsageTotals, item): UsageTotals => ({
      inputTokens: sum.inputTokens + Number(item?.inputTokens ?? 0),
      outputTokens: sum.outputTokens + Number(item?.outputTokens ?? 0),
      totalTokens: sum.totalTokens + Number(item?.totalTokens ?? 0),
      inputCost: sum.inputCost + Number(item?.inputCost ?? 0),
      outputCost: sum.outputCost + Number(item?.outputCost ?? 0),
      totalCost: sum.totalCost + Number(item?.totalCost ?? 0),
    }),
    {
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      inputCost: 0,
      outputCost: 0,
      totalCost: 0,
    } satisfies UsageTotals,
  );
  return {
    inputTokens: totals.inputTokens,
    outputTokens: totals.outputTokens,
    totalTokens: totals.totalTokens,
    inputCost: roundCurrency(totals.inputCost),
    outputCost: roundCurrency(totals.outputCost),
    totalCost: roundCurrency(totals.totalCost),
    ...(attribution ? { attribution } : {}),
  };
}

export function estimatePromptTokens(prompt: unknown) {
  if (typeof prompt !== 'string') return 0;
  const normalized = prompt.trim();
  if (!normalized) return 0;
  return Math.max(1, Math.ceil(normalized.length / 4));
}

function nonNegativeInteger(value: unknown) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : 0;
}

function roundCurrency(value: number) {
  return Number(value.toFixed(8));
}
