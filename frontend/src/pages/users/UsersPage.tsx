import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useUserStatsQuery, useUsersQuery } from '@/hooks/useAdminUsers';
import { useAuthStore } from '@/store/authStore';
import { formatDateTime } from '@/lib/date';
import type { AdminUserDto, CompanyUserRole } from '@/types';
import {
  Avatar,
  Badge,
  Button,
  DataTable,
  type DataTableColumn,
  EmptyState,
  FilterBar,
  PageHeader,
  Pagination,
  SearchInput,
  Select,
  StatusPill,
} from '@/ui';
import { PermissionsModal } from './PermissionsModal';
import { ResetPasswordModal } from './ResetPasswordModal';
import { UserFormModal } from './UserFormModal';
import { UserLogsModal } from './UserLogsModal';
import { UserStatsCards } from './UserStatsCards';

const FILTER_ROLES: CompanyUserRole[] = ['chemist', 'kontrolyor', 'lab_head', 'director', 'admin'];
type ModalKind = 'form' | 'reset' | 'perms' | 'logs';

export function UsersPage() {
  const { t } = useTranslation();
  const currentUser = useAuthStore((s) => s.user);
  const currentRole = currentUser?.role;
  const isDirector = currentRole === 'director';
  const isLabHead = currentRole === 'lab_head';
  const isAdmin = currentRole === 'admin';

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | CompanyUserRole>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'true' | 'false'>('all');
  const [modal, setModal] = useState<ModalKind | null>(null);
  const [selectedUser, setSelectedUser] = useState<AdminUserDto | null>(null);

  const queryParams = useMemo(
    () => ({
      page,
      limit: 10,
      search: search.trim() || undefined,
      role: roleFilter === 'all' ? undefined : roleFilter,
      isActive: statusFilter === 'all' ? undefined : statusFilter === 'true',
    }),
    [page, search, roleFilter, statusFilter],
  );
  const { data: usersData, isLoading: usersLoading, isError, refetch } = useUsersQuery(queryParams);
  const { data: statsData, isLoading: statsLoading } = useUserStatsQuery();
  const users = usersData?.data ?? [];
  const hasFilters = !!search || roleFilter !== 'all' || statusFilter !== 'all';

  const open = (kind: ModalKind, user: AdminUserDto | null) => {
    setSelectedUser(user);
    setModal(kind);
  };

  const columns = useMemo(() => {
    const cols: DataTableColumn<AdminUserDto>[] = [
      {
        key: 'fullName',
        header: t('users.fullName'),
        primary: true,
        sortValue: (row) => row.fullName,
        render: (row) => (
          <span className="flex items-center gap-3">
            <Avatar name={row.fullName} size="sm" />
            <span className="font-medium text-fg">{row.fullName}</span>
          </span>
        ),
      },
      {
        key: 'email',
        header: t('users.email'),
        render: (row) => <span className="text-fg-muted">{row.email}</span>,
      },
      {
        key: 'role',
        header: t('users.role'),
        render: (row) => <Badge>{t(`users.roles.${row.role}`)}</Badge>,
      },
      {
        key: 'status',
        header: t('users.status'),
        render: (row) => (
          <StatusPill tone={row.isActive ? 'success' : 'danger'}>
            {row.isActive ? t('users.form.active') : t('users.form.inactive')}
          </StatusPill>
        ),
      },
      {
        key: 'lastLogin',
        header: t('users.lastLogin'),
        hideOnMobile: true,
        render: (row) => (
          <span className="text-xs tabular-nums text-fg-muted">
            {row.lastLoginAt
              ? formatDateTime(row.lastLoginAt)
              : t('users.neverLoggedIn')}
          </span>
        ),
      },
    ];
    // Direktor faqat ko'radi — amallar ustuni yo'q
    if (!isDirector) {
      cols.push({
        key: 'actions',
        header: t('users.actions'),
        align: 'right',
        render: (row) => {
          // lab_head faqat kimyogar va kontrolyorni boshqaradi
          const canManageRow =
            isAdmin || (isLabHead && (row.role === 'chemist' || row.role === 'kontrolyor'));
          if (!canManageRow) return null;
          return (
            <div className="flex flex-wrap justify-end gap-1">
              <Button variant="ghost" size="sm" onClick={() => open('form', row)}>
                {t('users.edit')}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => open('reset', row)}>
                {t('users.resetPassword')}
              </Button>
              {isAdmin && (
                <Button variant="ghost" size="sm" onClick={() => open('perms', row)}>
                  {t('users.permissions')}
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={() => open('logs', row)}>
                {t('users.logs')}
              </Button>
            </div>
          );
        },
      });
    }
    return cols;
  }, [t, isDirector, isAdmin, isLabHead]);

  // Har modal faqat o'zini yopadi (kechiktirilgan yopilish boshqa ochilgan modalni yopmasin)
  const closeOf = (kind: ModalKind) => () => setModal((m) => (m === kind ? null : m));

  return (
    <>
      <PageHeader
        title={t('users.title')}
        description={t('users.subtitle')}
        actions={
          !isDirector && (
            <Button leftIcon="plus" onClick={() => open('form', null)}>
              {t('users.createUser')}
            </Button>
          )
        }
      />

      <UserStatsCards stats={statsData} loading={statsLoading} />

      <FilterBar
        onReset={() => {
          setSearch('');
          setRoleFilter('all');
          setStatusFilter('all');
          setPage(1);
        }}
        canReset={hasFilters}
      >
        <SearchInput
          value={search}
          onChange={(v) => {
            setSearch(v);
            setPage(1);
          }}
          placeholder={t('users.searchPlaceholder')}
          className="sm:w-72"
        />
        <Select
          aria-label={t('users.filterRole')}
          className="sm:w-48"
          options={[
            { value: 'all', label: t('users.allRoles') },
            ...FILTER_ROLES.map((r) => ({ value: r, label: t(`users.roles.${r}`) })),
          ]}
          value={roleFilter}
          onChange={(v) => {
            setRoleFilter(v);
            setPage(1);
          }}
        />
        <Select
          aria-label={t('users.filterStatus')}
          className="sm:w-44"
          options={[
            { value: 'all', label: t('companies.allStatuses') },
            { value: 'true', label: t('users.form.active') },
            { value: 'false', label: t('users.form.inactive') },
          ]}
          value={statusFilter}
          onChange={(v) => {
            setStatusFilter(v);
            setPage(1);
          }}
        />
      </FilterBar>

      <div>
        <DataTable
          caption={t('users.title')}
          columns={columns}
          rows={users}
          rowKey={(r) => r.id}
          loading={usersLoading}
          error={isError}
          onRetry={() => void refetch()}
          empty={<EmptyState icon="users" />}
        />
        {usersData?.meta && usersData.meta.total > 0 && (
          <Pagination meta={usersData.meta} onPageChange={setPage} showSummary />
        )}
      </div>

      <UserFormModal
        open={modal === 'form'}
        onClose={closeOf('form')}
        user={selectedUser}
        currentUserRole={currentRole ?? 'admin'}
        currentUserId={currentUser?.id ?? ''}
      />
      <ResetPasswordModal open={modal === 'reset'} onClose={closeOf('reset')} user={selectedUser} />
      {isAdmin && (
        <PermissionsModal open={modal === 'perms'} onClose={closeOf('perms')} user={selectedUser} />
      )}
      <UserLogsModal open={modal === 'logs'} onClose={closeOf('logs')} user={selectedUser} />
    </>
  );
}
