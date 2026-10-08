import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pagination } from '@/components/ui/Pagination';
import { Spinner } from '@/components/ui/Spinner';
import { type Column, Table } from '@/components/ui/Table';
import { useUserStatsQuery, useUsersQuery } from '@/hooks/useAdminUsers';
import { useAuthStore } from '@/store/authStore';
import type { AdminUserDto, CompanyUserRole } from '@/types';
import { PermissionsModal } from './PermissionsModal';
import { ResetPasswordModal } from './ResetPasswordModal';
import { UserFormModal } from './UserFormModal';
import { UserLogsModal } from './UserLogsModal';
import { UserStatsCards } from './UserStatsCards';

const FILTER_ROLES: CompanyUserRole[] = ['chemist', 'kontrolyor', 'lab_head', 'director', 'admin'];

export function UsersPage() {
  const { t } = useTranslation();
  const currentUser = useAuthStore((s) => s.user);
  const currentRole = currentUser?.role;
  const currentUserId = currentUser?.id ?? '';

  const isDirector = currentRole === 'director';
  const isLabHead = currentRole === 'lab_head';
  const isAdmin = currentRole === 'admin';

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | CompanyUserRole>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'true' | 'false'>('all');

  // Modals state
  const [formOpen, setFormOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [permsOpen, setPermsOpen] = useState(false);
  const [logsOpen, setLogsOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<AdminUserDto | null>(null);

  const queryParams = useMemo(() => {
    return {
      page,
      limit: 10,
      search: search.trim() || undefined,
      role: roleFilter === 'all' ? undefined : roleFilter,
      isActive: statusFilter === 'all' ? undefined : statusFilter === 'true',
    };
  }, [page, search, roleFilter, statusFilter]);

  const { data: usersData, isLoading: usersLoading } = useUsersQuery(queryParams);
  const { data: statsData, isLoading: statsLoading } = useUserStatsQuery();

  const handleOpenCreate = () => {
    setSelectedUser(null);
    setFormOpen(true);
  };

  const handleOpenEdit = (user: AdminUserDto) => {
    setSelectedUser(user);
    setFormOpen(true);
  };

  const handleOpenReset = (user: AdminUserDto) => {
    setSelectedUser(user);
    setResetOpen(true);
  };

  const handleOpenPerms = (user: AdminUserDto) => {
    setSelectedUser(user);
    setPermsOpen(true);
  };

  const handleOpenLogs = (user: AdminUserDto) => {
    setSelectedUser(user);
    setLogsOpen(true);
  };

  const users = usersData?.data ?? [];

  const columns: Column<AdminUserDto>[] = useMemo(() => {
    const cols: Column<AdminUserDto>[] = [
      {
        key: 'fullName',
        header: t('users.fullName'),
        render: (row) => <span className="font-medium text-slate-900">{row.fullName}</span>,
      },
      {
        key: 'email',
        header: t('users.email'),
        render: (row) => <span className="text-slate-600">{row.email}</span>,
      },
      {
        key: 'role',
        header: t('users.role'),
        render: (row) => (
          <span className="inline-flex items-center rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-800">
            {t(`users.roles.${row.role}`)}
          </span>
        ),
      },
      {
        key: 'status',
        header: t('users.status'),
        render: (row) => (
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
              row.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
            }`}
          >
            {row.isActive ? t('users.form.active') : t('users.form.inactive')}
          </span>
        ),
      },
      {
        key: 'lastLogin',
        header: t('users.lastLogin'),
        render: (row) => (
          <span className="text-slate-500">
            {row.lastLoginAt
              ? new Date(row.lastLoginAt).toLocaleString()
              : t('users.neverLoggedIn')}
          </span>
        ),
      },
    ];

    // Directors can only view, no actions column
    if (!isDirector) {
      cols.push({
        key: 'actions',
        header: t('users.actions'),
        render: (row) => {
          // Lab head can only act on chemist and kontrolyor
          const canManageRow = isAdmin || (isLabHead && (row.role === 'chemist' || row.role === 'kontrolyor'));
          if (!canManageRow) return null;

          return (
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => handleOpenEdit(row)}
                className="rounded border border-slate-300 px-2 py-0.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                {t('users.edit')}
              </button>
              <button
                type="button"
                onClick={() => handleOpenReset(row)}
                className="rounded border border-amber-300 px-2 py-0.5 text-xs font-medium text-amber-700 hover:bg-amber-50"
              >
                {t('users.resetPassword')}
              </button>
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => handleOpenPerms(row)}
                  className="rounded border border-indigo-300 px-2 py-0.5 text-xs font-medium text-indigo-700 hover:bg-indigo-50"
                >
                  {t('users.permissions')}
                </button>
              )}
              <button
                type="button"
                onClick={() => handleOpenLogs(row)}
                className="rounded border border-slate-300 px-2 py-0.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
              >
                {t('users.logs')}
              </button>
            </div>
          );
        },
      });
    }

    return cols;
  }, [t, isDirector, isAdmin, isLabHead]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            {t('users.title')}
          </h1>
          <p className="mt-1 text-sm text-slate-500">{t('users.subtitle')}</p>
        </div>
        {!isDirector && (
          <button
            type="button"
            onClick={handleOpenCreate}
            className="inline-flex items-center justify-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          >
            {t('users.createUser')}
          </button>
        )}
      </div>

      {/* Stats Cards */}
      <UserStatsCards stats={statsData} loading={statsLoading} />

      {/* Filters */}
      <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex-1">
          <input
            type="text"
            placeholder={t('users.searchPlaceholder')}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm placeholder-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="w-full sm:w-44">
            <select
              value={roleFilter}
              onChange={(e) => {
                setRoleFilter(e.target.value as 'all' | CompanyUserRole);
                setPage(1);
              }}
              aria-label={t('users.filterRole')}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="all">{t('users.allRoles')}</option>
              {FILTER_ROLES.map((role) => (
                <option key={role} value={role}>
                  {t(`users.roles.${role}`)}
                </option>
              ))}
            </select>
          </div>
          <div className="w-full sm:w-44">
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as 'all' | 'true' | 'false');
                setPage(1);
              }}
              aria-label={t('users.filterStatus')}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="all">{t('companies.allStatuses')}</option>
              <option value="true">{t('users.form.active')}</option>
              <option value="false">{t('users.form.inactive')}</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      {usersLoading ? (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      ) : (
        <>
          <Table
            columns={columns}
            rows={users}
            rowKey={(r) => r.id}
          />
          {usersData?.meta && usersData.meta.total > 0 && (
            <div className="flex justify-end">
              <Pagination meta={usersData.meta} onPageChange={setPage} />
            </div>
          )}
        </>
      )}

      {/* Modals */}
      <UserFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        user={selectedUser}
        currentUserRole={currentRole ?? 'admin'}
        currentUserId={currentUserId}
      />
      <ResetPasswordModal
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        user={selectedUser}
      />
      {isAdmin && (
        <PermissionsModal
          open={permsOpen}
          onClose={() => setPermsOpen(false)}
          user={selectedUser}
        />
      )}
      <UserLogsModal
        open={logsOpen}
        onClose={() => setLogsOpen(false)}
        user={selectedUser}
      />
    </div>
  );
}
