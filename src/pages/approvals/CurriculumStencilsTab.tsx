import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Card } from '../../components/Card';
import { Pagination } from '../../components/Pagination';
import { SearchBar } from '../../components/SearchBar';
import { StatusPill } from '../../components/StatusPill';
import { formatDate } from '../../utils/formatDate';
import { CURRICULUM_PAGE_SIZE, useCurriculumStencils, type StencilFile } from './useCurriculumStencils';
import { downloadProofPhoto, viewProofPhoto } from './ProofPhoto';

const STATUS_VARIANT = {
  approved: 'success',
  pending: 'warning',
  rejected: 'danger',
} as const;

const linkButtonClass = 'text-[12.5px] font-bold text-brand bg-none border-none cursor-pointer font-sans hover:underline disabled:opacity-50';

// "Other: <what they typed>" is one category value -- filter on the part
// before the colon so every custom "Other" topic lands in one bucket.
function categoryGroup(category: string): string {
  return category.split(':')[0].trim();
}

function StencilRow({ stencil }: { stencil: StencilFile }) {
  const [busy, setBusy] = useState(false);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    try {
      await action();
    } catch {
      toast.error('Could not open file', { description: 'Check your connection and try again.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center justify-between gap-3 py-[9px] border-t border-border">
      <div className="flex items-center gap-[10px] min-w-0">
        <i className="ti ti-file-type-pdf text-[20px] text-accent shrink-0" />
        <div className="min-w-0">
          <div className="text-[13px] font-semibold text-text">{stencil.label}</div>
          <div className="text-[11.5px] text-muted truncate">{stencil.fileName}</div>
        </div>
      </div>
      <div className="flex items-center gap-[14px] shrink-0">
        <button className={linkButtonClass} disabled={busy} onClick={() => run(() => viewProofPhoto(stencil.path))}>View</button>
        <button className={linkButtonClass} disabled={busy} onClick={() => run(() => downloadProofPhoto(stencil.path, stencil.fileName))}>Download</button>
      </div>
    </div>
  );
}

export function CurriculumStencilsTab() {
  const { submissions, loading } = useCurriculumStencils();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [page, setPage] = useState(1);

  const categories = useMemo(
    () => Array.from(new Set(submissions.map((s) => categoryGroup(s.category)))).sort(),
    [submissions]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return submissions.filter((s) => {
      if (category !== 'all' && categoryGroup(s.category) !== category) { return false; }
      if (!q) { return true; }
      return [s.displayName, s.displayChapter, s.category, s.description ?? ''].some((v) => v.toLowerCase().includes(q));
    });
  }, [submissions, search, category]);

  const from = (page - 1) * CURRICULUM_PAGE_SIZE;
  const visible = filtered.slice(from, from + CURRICULUM_PAGE_SIZE);

  return (
    <Card>
      <div className="text-[14px] font-bold text-text mb-4 flex items-center gap-2">
        <i className="ti ti-folder text-muted text-[17px]" /> Curriculum Stencils
        {!loading && <span className="text-[11px] font-bold text-muted normal-case">({filtered.length})</span>}
      </div>
      <div className="text-[12.5px] text-muted mb-[18px] leading-[1.5]">
        Every stencil PDF mentors have submitted, grouped by submission -- each card holds that mentor's full set (Workshop Slide Sprint, Infographic Jam, Resource Roundup, Letter to Leader) with the category they chose and the description they wrote. Submissions don't have a separate project-name field, so the description is the best identifier.
      </div>

      <div className="flex items-center gap-[10px] flex-wrap mb-[16px]">
        <SearchBar
          value={search}
          onChange={(v) => { setSearch(v); setPage(1); }}
          placeholder="Search by mentor, chapter, category, or description..."
          className="flex-1 min-w-[240px]"
        />
        <select
          value={category}
          onChange={(e) => { setCategory(e.target.value); setPage(1); }}
          className="px-[13px] py-[9px] border border-border rounded-lg text-[13px] text-text bg-bg outline-none font-sans"
        >
          <option value="all">All categories</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="text-center py-6 text-muted text-[13px]">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-6 text-muted text-[13px]">
          {submissions.length === 0 ? 'No curriculum stencils submitted yet.' : 'No submissions match your filters.'}
        </div>
      ) : (
        <div className="flex flex-col gap-[14px]">
          {visible.map((s) => (
            <div key={s.id} className="border border-border rounded-xl px-5 py-[16px]">
              <div className="flex items-start justify-between gap-3 flex-wrap mb-[10px]">
                <div>
                  <div className="text-[14px] font-bold text-text">{s.displayName}</div>
                  <div className="text-[11.5px] text-muted">
                    {s.displayChapter !== '-' ? `${s.displayChapter} · ` : ''}Submitted {formatDate(s.submitted_at, '—')} · {s.hours} hr{s.hours === 1 ? '' : 's'}
                  </div>
                </div>
                <StatusPill variant={STATUS_VARIANT[s.status]}>{s.status}</StatusPill>
              </div>

              <div className="mb-[8px]">
                <span className="text-[10.5px] font-bold px-[10px] py-[3px] rounded-full uppercase tracking-[0.03em] bg-hover-tint text-brand">
                  {s.category}
                </span>
              </div>
              <div className="text-[13px] text-text leading-[1.5] mb-[10px]">{s.description || <span className="text-muted">No description provided.</span>}</div>

              {s.stencils.length === 0 ? (
                <div className="text-[12px] text-muted border-t border-border pt-[9px]">No stencil files on this submission.</div>
              ) : (
                s.stencils.map((stencil) => <StencilRow key={stencil.key} stencil={stencil} />)
              )}
            </div>
          ))}
        </div>
      )}

      {filtered.length > 0 ? (
        <Pagination page={page} pageSize={CURRICULUM_PAGE_SIZE} total={filtered.length} onPageChange={setPage} />
      ) : null}
    </Card>
  );
}
