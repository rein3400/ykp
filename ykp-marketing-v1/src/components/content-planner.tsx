'use client';
import { useEffect, useMemo, useState } from 'react';
import {
  BRANDS,
  INITIAL_PLANS,
  PLAN_STATUSES,
  type ContentPlan,
  type PlanStatus
} from '@/data/marketing-preview';
import {
  ALL_BRANDS,
  STORAGE_KEYS,
  addPlan,
  filterPlans,
  removePlan,
  setPlanStatus
} from '@/lib/marketing-state';

export function ContentPlanner({ brand }: { brand: string }) {
  const [plans, setPlans] = useState<ContentPlan[]>(INITIAL_PLANS);
  const [title, setTitle] = useState('');
  const [planBrand, setPlanBrand] = useState<ContentPlan['brand']>(BRANDS[0]);
  const [channel, setChannel] = useState('Instagram');
  const [date, setDate] = useState('');

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.plans);
      if (raw) setPlans(JSON.parse(raw) as ContentPlan[]);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (brand && brand !== ALL_BRANDS) setPlanBrand(brand as ContentPlan['brand']);
  }, [brand]);

  function persist(next: ContentPlan[]) {
    setPlans(next);
    try {
      localStorage.setItem(STORAGE_KEYS.plans, JSON.stringify(next));
    } catch {
      // ignore
    }
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!title.trim()) return;
    const plan: ContentPlan = {
      id: `PLAN-${Date.now()}`,
      title: title.trim(),
      brand: planBrand,
      channel: channel.trim() || 'Instagram',
      date,
      status: 'Ide'
    };
    persist(addPlan(plans, plan));
    setTitle('');
    setDate('');
  }

  const visible = useMemo(() => filterPlans(plans, brand), [plans, brand]);

  return (
    <section id="content-planner" aria-labelledby="content-planner-title" className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 id="content-planner-title" className="text-lg font-bold text-ink">
          Content Planner
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Rencanakan konten per brand, atur status, lalu simpan.
        </p>
      </div>

      <form
        onSubmit={submit}
        className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-5"
      >
        <input
          aria-label="Judul konten"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Judul konten"
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm sm:col-span-2"
          required
        />
        <select
          aria-label="Brand"
          value={planBrand}
          onChange={(e) => setPlanBrand(e.target.value as ContentPlan['brand'])}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
        >
          {BRANDS.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
        <input
          aria-label="Kanal"
          value={channel}
          onChange={(e) => setChannel(e.target.value)}
          placeholder="Kanal (IG/TikTok)"
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
        />
        <input
          aria-label="Tanggal"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
        />
        <button
          type="submit"
          className="justify-self-start rounded-lg bg-[#E01020] px-4 py-2 text-sm font-semibold text-white hover:bg-[#9c0b16] sm:col-span-5"
        >
          Tambah rencana
        </button>
      </form>

      <div className="space-y-2">
        {visible.length === 0 && (
          <p className="rounded-2xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
            Belum ada rencana untuk brand ini.
          </p>
        )}
        {visible.map((plan) => (
          <div
            key={plan.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3"
          >
            <div className="min-w-0">
              <p className="font-semibold text-slate-800">{plan.title}</p>
              <p className="text-xs text-slate-500">
                {plan.brand} · {plan.channel}
                {plan.date ? ` · ${plan.date}` : ''}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <select
                aria-label={`Status ${plan.title}`}
                value={plan.status}
                onChange={(e) => persist(setPlanStatus(plans, plan.id, e.target.value as PlanStatus))}
                className="rounded-lg border border-slate-200 px-2 py-1 text-xs"
              >
                {PLAN_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => persist(removePlan(plans, plan.id))}
                className="rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
              >
                Hapus
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
