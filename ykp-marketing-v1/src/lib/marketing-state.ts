import type { ContentPlan, ContentReference, MetaGuideItem, PlanStatus } from '@/data/marketing-preview';

export const ALL_BRANDS = 'Semua';

export const STORAGE_KEYS = {
  brand: 'ykp-marketing:brand',
  guide: 'ykp-marketing:guide',
  plans: 'ykp-marketing:plans'
} as const;

export function filterReferences(refs: ContentReference[], brand: string): ContentReference[] {
  if (!brand || brand === ALL_BRANDS) return refs;
  return refs.filter((r) => r.brand === brand);
}

export function toggleDone(items: MetaGuideItem[], id: string): MetaGuideItem[] {
  return items.map((item) => (item.id === id ? { ...item, done: !item.done } : item));
}

export function countDone(items: MetaGuideItem[]): number {
  return items.filter((item) => item.done).length;
}

export function filterPlans(plans: ContentPlan[], brand: string): ContentPlan[] {
  if (!brand || brand === ALL_BRANDS) return plans;
  return plans.filter((plan) => plan.brand === brand);
}

export function addPlan(plans: ContentPlan[], plan: ContentPlan): ContentPlan[] {
  return [...plans, plan];
}

export function removePlan(plans: ContentPlan[], id: string): ContentPlan[] {
  return plans.filter((plan) => plan.id !== id);
}

export function setPlanStatus(plans: ContentPlan[], id: string, status: PlanStatus): ContentPlan[] {
  return plans.map((plan) => (plan.id === id ? { ...plan, status } : plan));
}
