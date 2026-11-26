import { type FormEvent, useEffect, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router';
import { getNdFileUrl } from '@/api/p17';
import {
  useEquipmentCategoriesQuery,
  useFeasibilityQuery,
  useNdFileMutation,
  useNdQuery,
  useNdRequirementMutation,
  useNdStatusMutation,
  useReagentItemsQuery,
} from '@/hooks/useP17';
import { errorMessage } from '@/lib/queryClient';
import { useAuthStore } from '@/store/authStore';
import type { FeasibilityReason, NdRequirementDto, NdRequirementInput } from '@/types/p17';
import {
  Alert,
  Button,
  ButtonLink,
  Card,
  DataTable,
  type DataTableColumn,
  DescriptionList,
  EmptyState,
  FileButton,
  FormField,
  Input,
  Modal,
  notify,
  PageHeader,
  PageSkeleton,
  Select,
  StatusPill,
} from '@/ui';
import { NdStatusPill } from './NdListPage';

/** Sabab matni — UI tilida tur va ma'lumot bo'yicha (backend `detail` — o'zbekcha zaxira). */
export function useReasonText() {
  const { t } = useTranslation();
  return (r: FeasibilityReason) =>
    t(`nd.reasons.${r.type}`, {
      ...r.data,
      status: r.data.status ? t(`equipment.status.${String(r.data.status)}`) : '',
      defaultValue: r.detail,
    });
}

function RequirementModal({
  ndId,
  req,
  open,
  onClose,
}: {
  ndId: string;
  req: NdRequirementDto | null;
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const formId = useId();
  const mutation = useNdRequirementMutation(ndId);
  const { data: categories = [] } = useEquipmentCategoriesQuery();
  const { data: items = [] } = useReagentItemsQuery();
  const [kind, setKind] = useState<'equipment' | 'reagent'>('reagent');
  const [methodName, setMethodName] = useState('');
  const [category, setCategory] = useState('');
  const [itemId, setItemId] = useState('');
  const [qty, setQty] = useState('');
  const [unit, setUnit] = useState('ml');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setKind(req?.kind ?? 'reagent');
    setMethodName(req?.methodName ?? '');
    setCategory(req?.equipmentCategory ?? '');
    setItemId(req?.reagentItemId ?? '');
    setQty(
      req?.quantityPerAnalysis !== null && req?.quantityPerAnalysis !== undefined
        ? String(req.quantityPerAnalysis)
        : '',
    );
    setUnit(req?.unit ?? 'ml');
  }, [open, req]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    let input: NdRequirementInput;
    if (kind === 'equipment') {
      if (!category.trim()) return setError(t('nd.errors.categoryRequired'));
      input = { kind, equipmentCategory: category.trim(), methodName: methodName.trim() || null };
    } else {
      const n = Number(qty);
      if (!itemId) return setError(t('nd.errors.reagentRequired'));
      if (!n || n <= 0) return setError(t('nd.errors.qtyPositive'));
      if (!unit.trim()) return setError(t('nd.errors.unitRequired'));
      input = {
        kind,
        reagentItemId: itemId,
        quantityPerAnalysis: n,
        unit: unit.trim(),
        methodName: methodName.trim() || null,
      };
    }
    try {
      await mutation.mutateAsync({ reqId: req?.id, input });
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={req ? t('nd.editRequirement') : t('nd.addRequirement')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" form={formId} loading={mutation.isPending}>
            {t('common.save')}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={(e) => void submit(e)} noValidate className="flex flex-col gap-4">
        {error && <Alert tone="danger">{error}</Alert>}
        <FormField id="req-kind" label={t('nd.requirementKind')}>
          <Select
            options={[
              { value: 'reagent', label: t('nd.kind.reagent') },
              { value: 'equipment', label: t('nd.kind.equipment') },
            ]}
            value={kind}
            onChange={setKind}
          />
        </FormField>
        <FormField id="req-method" label={t('nd.methodName')} hint={t('nd.methodHint')}>
          <Input value={methodName} onChange={(e) => setMethodName(e.target.value)} />
        </FormField>
        {kind === 'equipment' ? (
          <FormField id="req-category" label={t('equipment.category')} required>
            <Input
              value={category}
              list="nd-equipment-categories"
              onChange={(e) => setCategory(e.target.value)}
            />
            <datalist id="nd-equipment-categories">
              {categories.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </FormField>
        ) : (
          <>
            <FormField id="req-reagent" label={t('nd.reagent')} required>
              <Select
                options={[
                  { value: '', label: t('nd.chooseReagent') },
                  ...items.map((i) => ({ value: i.id, label: i.name })),
                ]}
                value={itemId}
                onChange={setItemId}
              />
            </FormField>
            <div className="grid grid-cols-2 gap-4">
              <FormField id="req-qty" label={t('nd.quantityPerAnalysis')} required>
                <Input
                  type="number"
                  step="any"
                  min="0"
                  value={qty}
                  onChange={(e) => setQty(e.target.value)}
                />
              </FormField>
              <FormField id="req-unit" label={t('nd.unit')} required hint={t('nd.unitHint')}>
                <Input value={unit} onChange={(e) => setUnit(e.target.value)} />
              </FormField>
            </div>
          </>
        )}
      </form>
    </Modal>
  );
}

function FeasibilityPanel({ ndId }: { ndId: string }) {
  const { t } = useTranslation();
  const reasonText = useReasonText();
  const [n, setN] = useState('1');
  const count = Math.min(100, Math.max(1, Number(n) || 1));
  const { data, isLoading, isError } = useFeasibilityQuery(ndId, count);

  return (
    <Card>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 className="text-sm font-semibold text-fg">{t('nd.feasibility.title')}</h2>
        <FormField id="feasibility-n" label={t('nd.feasibility.analyses')} className="w-36">
          <Input type="number" min="1" max="100" value={n} onChange={(e) => setN(e.target.value)} />
        </FormField>
      </div>
      <div className="mt-4 flex flex-col gap-3">
        {isLoading && <p className="text-sm text-fg-muted">{t('common.loading')}</p>}
        {isError && <Alert tone="danger">{t('common.loadError')}</Alert>}
        {data && (
          <>
            <Alert
              tone={data.canRun ? 'success' : 'danger'}
              title={data.canRun ? t('nd.feasibility.canRun') : t('nd.feasibility.cannotRun')}
            >
              {data.ndStatus !== 'approved' && t('nd.feasibility.draftNote')}
            </Alert>
            {data.reasons.length > 0 && (
              <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-fg">
                {data.reasons.map((r, i) => (
                  <li key={`${r.type}-${i}`}>{reasonText(r)}</li>
                ))}
              </ul>
            )}
            {data.reagents.length > 0 && (
              <DescriptionList
                columns={1}
                items={data.reagents.map((r) => ({
                  label: r.reagentName,
                  value: (
                    <span
                      className={r.ok ? 'tabular-nums' : 'font-medium tabular-nums text-danger-fg'}
                    >
                      {t('nd.feasibility.reagentLine', {
                        required: r.required,
                        available: r.available,
                        unit: r.unit,
                      })}
                    </span>
                  ),
                }))}
              />
            )}
          </>
        )}
      </div>
    </Card>
  );
}

/** D-176: ND kartasi — talablar (draft da tahrirlanadi), holat, fayl, moslik. */
export function NdDetailPage() {
  const { t } = useTranslation();
  const { id = '' } = useParams<{ id: string }>();
  const role = useAuthStore((s) => s.user?.role);
  const canWrite = role === 'lab_head' || role === 'admin';
  const { data: nd, isLoading, isError } = useNdQuery(id);
  const status = useNdStatusMutation(id);
  const reqMutation = useNdRequirementMutation(id);
  const fileMutation = useNdFileMutation(id);
  const [modal, setModal] = useState<{ open: boolean; req: NdRequirementDto | null }>({
    open: false,
    req: null,
  });

  if (isLoading) return <PageSkeleton variant="detail" />;
  if (isError || !nd) {
    return (
      <EmptyState
        titleAs="h1"
        icon="file-text"
        title={t('nd.notFound')}
        action={
          <ButtonLink to="/nd" leftIcon="arrow-left">
            {t('nd.backToList')}
          </ButtonLink>
        }
        className="py-20"
      />
    );
  }

  const editable = canWrite && nd.status === 'draft';
  const act = (action: 'approve' | 'revise' | 'archive') =>
    status.mutate(action, { onError: (err) => notify.error(errorMessage(err)) });

  const columns: DataTableColumn<NdRequirementDto>[] = [
    {
      key: 'kind',
      header: t('nd.requirementKind'),
      primary: true,
      render: (r) => (
        <StatusPill tone={r.kind === 'reagent' ? 'info' : 'accent'}>
          {t(`nd.kind.${r.kind}`)}
        </StatusPill>
      ),
    },
    { key: 'method', header: t('nd.methodName'), render: (r) => r.methodName || '—' },
    {
      key: 'what',
      header: t('nd.requirement'),
      render: (r) =>
        r.kind === 'equipment'
          ? r.equipmentCategory
          : t('nd.reagentLine', {
              name: r.reagentItemName,
              qty: r.quantityPerAnalysis,
              unit: r.unit,
            }),
    },
    ...(editable
      ? [
          {
            key: 'actions',
            header: t('common.actions'),
            align: 'right' as const,
            render: (r: NdRequirementDto) => (
              <div className="flex justify-end gap-1">
                <Button variant="ghost" size="sm" onClick={() => setModal({ open: true, req: r })}>
                  {t('common.edit')}
                </Button>
                <Button
                  variant="danger-ghost"
                  size="sm"
                  loading={reqMutation.isPending}
                  onClick={() =>
                    reqMutation.mutate(
                      { reqId: r.id, remove: true },
                      { onError: (err) => notify.error(errorMessage(err)) },
                    )
                  }
                >
                  {t('common.delete')}
                </Button>
              </div>
            ),
          },
        ]
      : []),
  ];

  return (
    <>
      <PageHeader
        back={{ to: '/nd', label: t('nd.title') }}
        title={`${nd.code}${nd.version ? ` (${nd.version})` : ''}`}
        description={nd.name}
        meta={<NdStatusPill status={nd.status} />}
        actions={
          canWrite && (
            <>
              {nd.status === 'draft' && (
                <Button leftIcon="check" loading={status.isPending} onClick={() => act('approve')}>
                  {t('nd.approve')}
                </Button>
              )}
              {nd.status !== 'draft' && (
                <Button
                  variant="secondary"
                  loading={status.isPending}
                  onClick={() => act('revise')}
                >
                  {t('nd.revise')}
                </Button>
              )}
              {nd.status !== 'archived' && (
                <Button variant="ghost" loading={status.isPending} onClick={() => act('archive')}>
                  {t('nd.archive')}
                </Button>
              )}
            </>
          )
        }
      />

      {nd.status === 'draft' && <Alert tone="warning">{t('nd.draftNotice')}</Alert>}

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0 text-sm">
            <p className="font-medium text-fg">{t('nd.file')}</p>
            <p className="truncate text-fg-muted">{nd.fileName ?? t('nd.noFile')}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {nd.hasFile && (
              <Button
                variant="secondary"
                size="sm"
                leftIcon="download"
                onClick={() =>
                  void getNdFileUrl(nd.id)
                    .then(({ url }) => window.open(url, '_blank'))
                    .catch((err) => notify.error(errorMessage(err)))
                }
              >
                {t('common.download')}
              </Button>
            )}
            {canWrite && (
              <FileButton
                size="sm"
                leftIcon="upload"
                accept={['.pdf', '.jpg', '.jpeg', '.png']}
                loading={fileMutation.isPending}
                onSelect={(file) =>
                  fileMutation.mutate(file, { onError: (err) => notify.error(errorMessage(err)) })
                }
              >
                {t('nd.uploadFile')}
              </FileButton>
            )}
          </div>
        </div>
      </Card>

      <Card>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-fg">{t('nd.requirements')}</h2>
          {editable && (
            <Button size="sm" leftIcon="plus" onClick={() => setModal({ open: true, req: null })}>
              {t('nd.addRequirement')}
            </Button>
          )}
        </div>
        <DataTable
          caption={t('nd.requirements')}
          columns={columns}
          rows={nd.requirements}
          rowKey={(r) => r.id}
          empty={<EmptyState size="sm" icon="clipboard" title={t('nd.noRequirements')} />}
        />
      </Card>

      <FeasibilityPanel ndId={nd.id} />

      <RequirementModal
        ndId={nd.id}
        req={modal.req}
        open={modal.open}
        onClose={() => setModal({ open: false, req: null })}
      />
    </>
  );
}
