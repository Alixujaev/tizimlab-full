import { type FormEvent, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';
import { useNdListQuery, useSaveNdMutation } from '@/hooks/useP17';
import { errorMessage } from '@/lib/queryClient';
import { useAuthStore } from '@/store/authStore';
import type { NdDto, NdStatus } from '@/types/p17';
import {
  Alert,
  Button,
  DataTable,
  type DataTableColumn,
  EmptyState,
  FilterBar,
  FormField,
  Input,
  Modal,
  PageHeader,
  Pagination,
  SearchInput,
  StatusPill,
  Tabs,
  type Tone,
} from '@/ui';

export const ND_STATUS_TONE: Record<NdStatus, Tone> = {
  draft: 'warning',
  approved: 'success',
  archived: 'neutral',
};

export function NdStatusPill({ status }: { status: NdStatus }) {
  const { t } = useTranslation();
  return <StatusPill tone={ND_STATUS_TONE[status]}>{t(`nd.status.${status}`)}</StatusPill>;
}

function NdCreateModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const formId = useId();
  const navigate = useNavigate();
  const save = useSaveNdMutation();
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [version, setVersion] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !name.trim()) {
      setError(t('nd.errors.required'));
      return;
    }
    try {
      const nd = await save.mutateAsync({
        input: { code: code.trim(), name: name.trim(), version: version.trim() || null },
      });
      onClose();
      navigate(`/nd/${nd.id}`);
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('nd.create')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" form={formId} loading={save.isPending}>
            {t('common.save')}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={(e) => void submit(e)} noValidate className="flex flex-col gap-4">
        {error && <Alert tone="danger">{error}</Alert>}
        <FormField id="nd-code" label={t('nd.code')} required>
          <Input value={code} onChange={(e) => setCode(e.target.value)} />
        </FormField>
        <FormField id="nd-name" label={t('nd.name')} required>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </FormField>
        <FormField id="nd-version" label={t('nd.version')}>
          <Input value={version} onChange={(e) => setVersion(e.target.value)} />
        </FormField>
      </form>
    </Modal>
  );
}

/** D-176 (TZ §3.2–§3.3): normativ hujjatlar ro'yxati. */
export function NdListPage() {
  const { t } = useTranslation();
  const role = useAuthStore((s) => s.user?.role);
  const canWrite = role === 'lab_head' || role === 'admin';
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'all' | NdStatus>('all');
  const [createOpen, setCreateOpen] = useState(false);
  const { data, isLoading, isError, refetch } = useNdListQuery({
    page,
    limit: 20,
    search: search.trim() || undefined,
    status: status === 'all' ? undefined : status,
  });

  const columns: DataTableColumn<NdDto>[] = [
    {
      key: 'code',
      header: t('nd.code'),
      primary: true,
      render: (r) => (
        <Link
          to={`/nd/${r.id}`}
          className="rounded-sm font-medium text-fg transition-colors motion-fast focus-ring hover:text-primary"
        >
          {r.code}
          {r.version ? ` (${r.version})` : ''}
        </Link>
      ),
    },
    { key: 'name', header: t('nd.name'), render: (r) => r.name },
    {
      key: 'status',
      header: t('common.status'),
      render: (r) => <NdStatusPill status={r.status} />,
    },
    {
      key: 'reqs',
      header: t('nd.requirementCount'),
      align: 'right',
      hideOnMobile: true,
      render: (r) => <span className="tabular-nums">{r.requirementCount}</span>,
    },
  ];

  return (
    <>
      <PageHeader
        title={t('nd.title')}
        description={t('nd.subtitle')}
        actions={
          canWrite && (
            <Button leftIcon="plus" onClick={() => setCreateOpen(true)}>
              {t('nd.create')}
            </Button>
          )
        }
      />
      <FilterBar>
        <SearchInput
          value={search}
          onChange={(v) => {
            setSearch(v);
            setPage(1);
          }}
          aria-label={t('common.search')}
          className="sm:w-72"
        />
        <Tabs
          label={t('ui.filters')}
          className="sm:ml-auto"
          value={status}
          onChange={(v) => {
            setStatus(v);
            setPage(1);
          }}
          items={[
            { id: 'all', label: t('common.all') },
            { id: 'draft', label: t('nd.status.draft') },
            { id: 'approved', label: t('nd.status.approved') },
            { id: 'archived', label: t('nd.status.archived') },
          ]}
        />
      </FilterBar>
      <div>
        <DataTable
          caption={t('nd.title')}
          columns={columns}
          rows={data?.data ?? []}
          rowKey={(r) => r.id}
          loading={isLoading}
          error={isError}
          onRetry={() => void refetch()}
          empty={<EmptyState icon="file-text" title={t('nd.empty')} />}
        />
        {data && data.meta.total > data.meta.limit && (
          <Pagination meta={data.meta} onPageChange={setPage} showSummary />
        )}
      </div>
      <NdCreateModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </>
  );
}
