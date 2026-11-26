import { type FormEvent, useEffect, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router';
import {
  useDeleteEquipmentMutation,
  useEquipmentCategoriesQuery,
  useEquipmentItemQuery,
  useEquipmentQuery,
  useSaveEquipmentMutation,
} from '@/hooks/useP17';
import { formatDate } from '@/lib/date';
import { errorMessage } from '@/lib/queryClient';
import { useAuthStore } from '@/store/authStore';
import type { EquipmentDto, EquipmentInput, EquipmentStatus } from '@/types/p17';
import {
  Alert,
  Button,
  ConfirmDialog,
  DataTable,
  type DataTableColumn,
  DatePicker,
  EmptyState,
  FilterBar,
  FormField,
  Input,
  Modal,
  PageHeader,
  Pagination,
  SearchInput,
  Select,
  StatusPill,
  Tabs,
  Textarea,
  type Tone,
} from '@/ui';

const STATUSES: EquipmentStatus[] = ['active', 'maintenance', 'out_of_service'];
const STATUS_TONE: Record<EquipmentStatus, Tone> = {
  active: 'success',
  maintenance: 'warning',
  out_of_service: 'danger',
};

type QuickFilter = 'all' | 'calibration' | EquipmentStatus;

/** Apparat holati + kalibrlash belgisi (ro'yxat va modal). */
export function EquipmentBadges({ item }: { item: EquipmentDto }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap gap-1">
      <StatusPill tone={STATUS_TONE[item.status]}>
        {t(`equipment.status.${item.status}`)}
      </StatusPill>
      {item.isCalibrationExpired && (
        <StatusPill tone="danger">{t('equipment.calibrationExpired')}</StatusPill>
      )}
      {item.isCalibrationDueSoon && (
        <StatusPill tone="warning">{t('equipment.calibrationSoon')}</StatusPill>
      )}
    </div>
  );
}

const EMPTY: EquipmentInput = {
  name: '',
  category: '',
  model: '',
  serialNumber: '',
  location: '',
  status: 'active',
  calibrationDue: '',
  notes: '',
};

function EquipmentFormModal({
  item,
  open,
  readOnly,
  onClose,
}: {
  item: EquipmentDto | null;
  open: boolean;
  readOnly: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const formId = useId();
  const save = useSaveEquipmentMutation();
  const { data: categories = [] } = useEquipmentCategoriesQuery();
  const [form, setForm] = useState<EquipmentInput>(EMPTY);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setForm(
      item
        ? {
            name: item.name,
            category: item.category,
            model: item.model ?? '',
            serialNumber: item.serialNumber ?? '',
            location: item.location ?? '',
            status: item.status,
            calibrationDue: item.calibrationDue ?? '',
            notes: item.notes ?? '',
          }
        : EMPTY,
    );
  }, [open, item]);

  const set = <K extends keyof EquipmentInput>(k: K, v: EquipmentInput[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.category.trim()) {
      setError(t('equipment.errors.required'));
      return;
    }
    const opt = (v: string | null | undefined) => (v && v.trim() ? v.trim() : null);
    try {
      await save.mutateAsync({
        id: item?.id,
        input: {
          name: form.name.trim(),
          category: form.category.trim(),
          model: opt(form.model),
          serialNumber: opt(form.serialNumber),
          location: opt(form.location),
          status: form.status,
          calibrationDue: opt(form.calibrationDue),
          notes: opt(form.notes),
        },
      });
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={item ? (readOnly ? item.name : t('equipment.edit')) : t('equipment.create')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {readOnly ? t('common.close') : t('common.cancel')}
          </Button>
          {!readOnly && (
            <Button type="submit" form={formId} loading={save.isPending}>
              {t('common.save')}
            </Button>
          )}
        </>
      }
    >
      <form id={formId} onSubmit={(e) => void submit(e)} noValidate className="flex flex-col gap-4">
        {error && <Alert tone="danger">{error}</Alert>}
        {item && <EquipmentBadges item={item} />}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField id="eq-name" label={t('equipment.name')} required>
            <Input
              value={form.name}
              disabled={readOnly}
              onChange={(e) => set('name', e.target.value)}
            />
          </FormField>
          <FormField
            id="eq-category"
            label={t('equipment.category')}
            required
            hint={t('equipment.categoryHint')}
          >
            <Input
              value={form.category}
              disabled={readOnly}
              list="equipment-categories"
              onChange={(e) => set('category', e.target.value)}
            />
          </FormField>
          <FormField id="eq-model" label={t('equipment.model')}>
            <Input
              value={form.model ?? ''}
              disabled={readOnly}
              onChange={(e) => set('model', e.target.value)}
            />
          </FormField>
          <FormField id="eq-serial" label={t('equipment.serialNumber')}>
            <Input
              value={form.serialNumber ?? ''}
              disabled={readOnly}
              onChange={(e) => set('serialNumber', e.target.value)}
            />
          </FormField>
          <FormField id="eq-location" label={t('equipment.location')}>
            <Input
              value={form.location ?? ''}
              disabled={readOnly}
              onChange={(e) => set('location', e.target.value)}
            />
          </FormField>
          <FormField id="eq-status" label={t('equipment.statusLabel')}>
            <Select
              disabled={readOnly}
              options={STATUSES.map((s) => ({ value: s, label: t(`equipment.status.${s}`) }))}
              value={form.status ?? 'active'}
              onChange={(v) => set('status', v)}
            />
          </FormField>
          <FormField id="eq-calibration" label={t('equipment.calibrationDue')}>
            <DatePicker
              value={form.calibrationDue ?? ''}
              disabled={readOnly}
              onChange={(v) => set('calibrationDue', v)}
            />
          </FormField>
        </div>
        <FormField id="eq-notes" label={t('equipment.notes')}>
          <Textarea
            rows={2}
            value={form.notes ?? ''}
            disabled={readOnly}
            onChange={(e) => set('notes', e.target.value)}
          />
        </FormField>
        <datalist id="equipment-categories">
          {categories.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      </form>
    </Modal>
  );
}

/** D-175 (TZ §3.3): laboratoriya apparatlari. Yozish — lab_head va admin. */
export function EquipmentPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const role = useAuthStore((s) => s.user?.role);
  const canWrite = role === 'lab_head' || role === 'admin';

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<QuickFilter>('all');
  const [editing, setEditing] = useState<EquipmentDto | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [toDelete, setToDelete] = useState<EquipmentDto | null>(null);
  const del = useDeleteEquipmentMutation();
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const { data, isLoading, isError, refetch } = useEquipmentQuery({
    page,
    limit: 20,
    search: search.trim() || undefined,
    status: filter !== 'all' && filter !== 'calibration' ? filter : undefined,
    calibrationDueWithinDays: filter === 'calibration' ? 30 : undefined,
  });

  // /equipment/:id — Telegram/xabarnoma havolasi: apparat kartasi ochiladi
  const { data: linked } = useEquipmentItemQuery(id);
  useEffect(() => {
    if (linked) {
      setEditing(linked);
      setFormOpen(true);
    }
  }, [linked]);

  const closeForm = () => {
    setFormOpen(false);
    setEditing(null);
    if (id) navigate('/equipment', { replace: true });
  };

  const columns: DataTableColumn<EquipmentDto>[] = [
    {
      key: 'name',
      header: t('equipment.name'),
      primary: true,
      render: (r) => (
        <div className="min-w-0">
          <span className="font-medium text-fg">{r.name}</span>
          {(r.model || r.serialNumber) && (
            <div className="text-xs text-fg-muted">
              {[r.model, r.serialNumber].filter(Boolean).join(' · ')}
            </div>
          )}
        </div>
      ),
    },
    { key: 'category', header: t('equipment.category'), render: (r) => r.category },
    { key: 'status', header: t('common.status'), render: (r) => <EquipmentBadges item={r} /> },
    {
      key: 'calibrationDue',
      header: t('equipment.calibrationDue'),
      render: (r) => (
        <span
          className={
            r.isCalibrationExpired ? 'font-medium text-danger-fg' : 'tabular-nums text-fg-muted'
          }
        >
          {formatDate(r.calibrationDue)}
        </span>
      ),
    },
    {
      key: 'location',
      header: t('equipment.location'),
      hideOnMobile: true,
      render: (r) => <span className="text-fg-muted">{r.location || '—'}</span>,
    },
    {
      key: 'actions',
      header: t('common.actions'),
      align: 'right',
      render: (r) => (
        <div className="flex flex-wrap justify-end gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setEditing(r);
              setFormOpen(true);
            }}
          >
            {canWrite ? t('common.edit') : t('common.detail')}
          </Button>
          {canWrite && (
            <Button
              variant="danger-ghost"
              size="sm"
              onClick={() => {
                setDeleteError(null);
                setToDelete(r);
              }}
            >
              {t('common.delete')}
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title={t('equipment.title')}
        description={t('equipment.subtitle')}
        actions={
          canWrite && (
            <Button
              leftIcon="plus"
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              {t('equipment.create')}
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
          value={filter}
          onChange={(v) => {
            setFilter(v);
            setPage(1);
          }}
          items={[
            { id: 'all', label: t('common.all') },
            { id: 'calibration', label: t('equipment.filterCalibration') },
            ...STATUSES.map((s) => ({ id: s, label: t(`equipment.status.${s}`) })),
          ]}
        />
      </FilterBar>
      <div>
        <DataTable
          caption={t('equipment.title')}
          columns={columns}
          rows={data?.data ?? []}
          rowKey={(r) => r.id}
          loading={isLoading}
          error={isError}
          onRetry={() => void refetch()}
          empty={<EmptyState icon="monitor" title={t('equipment.empty')} />}
        />
        {data && data.meta.total > data.meta.limit && (
          <Pagination meta={data.meta} onPageChange={setPage} showSummary />
        )}
      </div>
      <EquipmentFormModal item={editing} open={formOpen} readOnly={!canWrite} onClose={closeForm} />
      <ConfirmDialog
        open={!!toDelete}
        title={t('equipment.delete')}
        description={deleteError ?? t('equipment.deleteConfirm')}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
        loading={del.isPending}
        onConfirm={() => {
          if (!toDelete) return;
          del.mutate(toDelete.id, {
            onSuccess: () => setToDelete(null),
            onError: (err) => setDeleteError(errorMessage(err)),
          });
        }}
        onCancel={() => setToDelete(null)}
      />
    </>
  );
}
