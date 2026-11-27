import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';
import { OosStatusPill } from '@/components/oos/OosStatusPill';
import { canManageRag, canWriteOos } from '@/config/oos';
import {
  useChatSessionsQuery,
  useCreateChatSessionMutation,
  useOosListQuery,
} from '@/hooks/useOos';
import { formatDateTime } from '@/lib/date';
import { useAuthStore } from '@/store/authStore';
import type { OosCaseDto, OosStatus } from '@/types';
import {
  Button,
  ButtonLink,
  Card,
  DataTable,
  type DataTableColumn,
  FilterBar,
  PageHeader,
  Pagination,
  Pressable,
  SearchInput,
  Select,
} from '@/ui';

const STATUSES: OosStatus[] = ['open', 'investigating', 'closed'];

/** P19: OOS jurnali — holat/qidiruv filtri, erkin AI suhbatlar va bilim bazasi havolasi. */
export function OosListPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const role = useAuthStore((s) => s.user?.role);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<OosStatus | ''>('');
  const [page, setPage] = useState(1);
  const params = { page, limit: 20, search: search || undefined, status: status || undefined };
  const { data, isLoading, isError, refetch } = useOosListQuery(params);
  const { data: sessions } = useChatSessionsQuery();
  const create = useCreateChatSessionMutation();
  const canWrite = canWriteOos(role);
  const freeSessions = (sessions ?? []).filter((s) => !s.caseId);

  const newQuestion = () =>
    create.mutate({}, { onSuccess: (s) => void navigate(`/oos/chat/${s.id}`) });

  const columns: DataTableColumn<OosCaseDto>[] = [
    {
      key: 'substance',
      header: t('oos.columns.substance'),
      primary: true,
      render: (c) => (
        <div className="min-w-0">
          <Link
            to={`/oos/${c.id}`}
            className="rounded-sm font-medium text-fg transition-colors motion-fast focus-ring hover:text-primary"
          >
            {c.substanceName ?? '—'}
          </Link>
          <div className="font-mono text-xs text-fg-muted">{c.serialNumber ?? '—'}</div>
        </div>
      ),
    },
    { key: 'test', header: t('oos.fields.testName'), render: (c) => c.testName },
    {
      key: 'result',
      header: t('oos.columns.result'),
      render: (c) => (
        <span className="text-sm tabular-nums">
          {t('oos.resultVsSpec', {
            result: [c.resultValue, c.unit].filter(Boolean).join(' '),
            spec: c.specLimit,
          })}
        </span>
      ),
    },
    {
      key: 'status',
      header: t('common.status'),
      render: (c) => <OosStatusPill status={c.status} />,
    },
    {
      key: 'opened',
      header: t('oos.columns.opened'),
      hideOnMobile: true,
      render: (c) => (
        <div className="text-xs text-fg-muted">
          <div className="tabular-nums">{formatDateTime(c.openedAt)}</div>
          <div>{c.openedByName ?? '—'}</div>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title={t('oos.title')}
        description={t('oos.subtitle')}
        actions={
          <>
            {canManageRag(role) && (
              <ButtonLink to="/knowledge-base" variant="secondary" leftIcon="layers">
                {t('rag.title')}
              </ButtonLink>
            )}
            {canWrite && (
              <Button leftIcon="plus" loading={create.isPending} onClick={newQuestion}>
                {t('oos.chat.newQuestion')}
              </Button>
            )}
          </>
        }
      />

      <FilterBar
        canReset={Boolean(search || status)}
        onReset={() => {
          setSearch('');
          setStatus('');
          setPage(1);
        }}
      >
        <SearchInput
          value={search}
          onChange={(v) => {
            setSearch(v);
            setPage(1);
          }}
          placeholder={t('oos.searchPlaceholder')}
          className="sm:w-72"
        />
        <Select
          aria-label={t('common.status')}
          className="sm:w-56"
          value={status}
          onChange={(v) => {
            setStatus(v as OosStatus | '');
            setPage(1);
          }}
          options={[
            { value: '', label: t('oos.allStatuses') },
            ...STATUSES.map((s) => ({ value: s, label: t(`oos.status.${s}`) })),
          ]}
        />
      </FilterBar>

      <DataTable
        columns={columns}
        rows={data?.data ?? []}
        rowKey={(c) => c.id}
        loading={isLoading}
        error={isError}
        onRetry={() => void refetch()}
        caption={t('oos.title')}
        emptyText={t('oos.empty')}
        onRowClick={(c) => void navigate(`/oos/${c.id}`)}
      />
      {data && <Pagination meta={data.meta} onPageChange={setPage} />}

      {freeSessions.length > 0 && (
        <Card title={t('oos.chat.freeSessions')} description={t('oos.chat.freeSessionsHint')} flush>
          <ul className="divide-y divide-line">
            {freeSessions.map((s) => (
              <li key={s.id}>
                <Pressable onClick={() => void navigate(`/oos/chat/${s.id}`)}>
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-sm font-medium text-fg">
                      {s.title ?? t('oos.chat.sessionFrom', { date: formatDateTime(s.createdAt) })}
                    </span>
                    <span className="text-xs text-fg-muted">
                      {[s.createdByName, formatDateTime(s.updatedAt)].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                </Pressable>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
