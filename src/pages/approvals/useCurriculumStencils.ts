import { useCallback, useEffect, useState } from 'react';
import { api, apiOrToast } from '../../lib/apiClient';
import { resolveDisplay, type EmbeddedProfile } from './shared';

// The mentor curriculum wizard posts ONE service_logs row per submission
// (activity_type 'Curriculum Development') with all four stencil PDFs
// inside verification_details -- { category, stencils: { infographic,
// letter, resource, workshop } }, each stencil { path, name } pointing
// into the private proof-uploads bucket. The row itself is the group: there
// is no project name/ID field, so category + description are what identify
// a submission.
const STENCIL_LABELS: Record<string, string> = {
  infographic: 'Infographic Jam',
  letter: 'Letter to Leader',
  resource: 'Resource Roundup',
  workshop: 'Workshop Slide Sprint',
};
const STENCIL_ORDER = ['workshop', 'infographic', 'resource', 'letter'];

export interface StencilFile {
  key: string;
  label: string;
  path: string;
  fileName: string;
}

export interface CurriculumSubmission {
  id: string;
  status: 'pending' | 'approved' | 'rejected';
  submitted_at: string;
  hours: number;
  description: string | null;
  category: string;
  displayName: string;
  displayChapter: string;
  stencils: StencilFile[];
}

interface ServiceLogApiRow {
  id: string;
  name: string | null;
  org_name: string | null;
  status: 'pending' | 'approved' | 'rejected';
  submitted_at: string;
  hours: number;
  description: string | null;
  verification_details: unknown;
  profiles: EmbeddedProfile | null;
}

function parseDetails(details: unknown): { category: string; stencils: StencilFile[] } {
  const d = (details && typeof details === 'object' ? details : {}) as {
    category?: unknown;
    stencils?: Record<string, { path?: unknown; name?: unknown } | null | undefined>;
  };
  const stencilMap = d.stencils && typeof d.stencils === 'object' ? d.stencils : {};

  const stencils: StencilFile[] = [];
  const keys = [...STENCIL_ORDER, ...Object.keys(stencilMap).filter((k) => !STENCIL_ORDER.includes(k))];
  keys.forEach((key) => {
    const entry = stencilMap[key];
    if (!entry || typeof entry.path !== 'string' || !entry.path) { return; }
    stencils.push({
      key,
      label: STENCIL_LABELS[key] ?? key,
      path: entry.path,
      fileName: typeof entry.name === 'string' && entry.name ? entry.name : entry.path.split('/').pop() || 'stencil.pdf',
    });
  });

  return { category: typeof d.category === 'string' && d.category ? d.category : 'Uncategorized', stencils };
}

export const CURRICULUM_PAGE_SIZE = 10;

// Every curriculum submission across all statuses -- not just pending --
// so the stencil PDFs stay reachable after a submission leaves the
// approval queue.
export function useCurriculumStencils() {
  const [allRows, setAllRows] = useState<CurriculumSubmission[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await apiOrToast(
      api.get<{ data: ServiceLogApiRow[] }>('/service-logs?activityTypeContains=curriculum'),
      'Loading curriculum stencils',
      { data: [] }
    );

    setAllRows(
      result.data.map((row) => {
        const display = resolveDisplay(row);
        const { category, stencils } = parseDetails(row.verification_details);
        return {
          id: row.id,
          status: row.status,
          submitted_at: row.submitted_at,
          hours: row.hours,
          description: row.description,
          category,
          displayName: display.name,
          displayChapter: display.chapter,
          stencils,
        };
      })
    );
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  return { submissions: allRows, loading, reload: load };
}
