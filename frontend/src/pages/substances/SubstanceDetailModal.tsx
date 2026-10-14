import { useTranslation } from 'react-i18next';
import { useSubstanceQuery } from '@/hooks/useSubstances';
import { getSubstanceName } from '@/lib/substances';
import type { SubstanceParameterDto } from '@/types';
import {
  Badge,
  Button,
  DataTable,
  type DataTableColumn,
  DescriptionList,
  EmptyState,
  Modal,
  Skeleton,
  StatusPill,
} from '@/ui';

interface SubstanceDetailModalProps {
  open: boolean;
  onClose: () => void;
  substanceId: string | null;
}

const num = (v: number | null) => (v !== null ? v : '—');

export function SubstanceDetailModal({ open, onClose, substanceId }: SubstanceDetailModalProps) {
  const { t, i18n } = useTranslation();
  const { data: substance, isLoading } = useSubstanceQuery(substanceId ?? '');

  if (!open || !substanceId) return null;

  const currentName = substance ? getSubstanceName(substance, i18n.language) : '';
  const params = substance?.parameters ?? [];

  const columns: DataTableColumn<SubstanceParameterDto>[] = [
    {
      key: 'idx',
      header: '#',
      render: (p) => <span className="font-mono text-fg-subtle">{params.indexOf(p) + 1}</span>,
    },
    {
      key: 'name',
      header: t('substances.parameterName', 'Parametr nomi'),
      primary: true,
      render: (p) => <span className="font-medium">{p.parameterName}</span>,
    },
    { key: 'min', header: t('substances.specMin', 'Min chegara'), render: (p) => num(p.specMin) },
    { key: 'max', header: t('substances.specMax', 'Max chegara'), render: (p) => num(p.specMax) },
    { key: 'unit', header: t('substances.unit', 'Birlik'), render: (p) => p.unit || '—' },
    {
      key: 'method',
      header: t('substances.method', 'Tahlil metodi'),
      render: (p) => p.method || '—',
    },
  ];

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title={currentName || t('substances.detailTitle', 'Modda tafsilotlari')}
      footer={
        <Button variant="secondary" onClick={onClose}>
          {t('common.close', 'Yopish')}
        </Button>
      }
    >
      {isLoading || !substance ? (
        <div role="status" className="flex flex-col gap-4">
          <span className="sr-only">{t('common.loading')}</span>
          <Skeleton variant="rect" className="h-28 w-full" />
          <Skeleton variant="rect" className="h-40 w-full" />
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          <DescriptionList
            columns={3}
            className="rounded-lg border border-line bg-surface-muted p-4"
            items={[
              { label: t('substances.nameUz', 'Nomi (O‘zbekcha)'), value: substance.nameUz },
              { label: t('substances.nameRu', 'Nomi (Ruscha)'), value: substance.nameRu },
              { label: t('substances.nameEn', 'Nomi (Inglizcha)'), value: substance.nameEn },
              {
                label: t('substances.pharmacopoeia', 'Farmakopiya'),
                value: <Badge tone="primary">{substance.pharmacopoeia}</Badge>,
              },
              {
                label: t('substances.casNumber', 'CAS raqami'),
                value: substance.casNumber,
                mono: true,
              },
              {
                label: t('common.status', 'Holati'),
                value: (
                  <StatusPill tone={substance.isActive ? 'success' : 'neutral'}>
                    {substance.isActive
                      ? t('common.active', 'Faol')
                      : t('common.inactive', 'Nofaol')}
                  </StatusPill>
                ),
              },
              substance.description
                ? {
                    label: t('substances.description', 'Tavsif'),
                    value: substance.description,
                    wide: true,
                  }
                : null,
            ]}
          />

          <section className="flex flex-col gap-3">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-fg">
              {t('substances.parameters', 'Modda parametrlari')}
              <Badge size="sm">{params.length}</Badge>
            </h3>
            {params.length === 0 ? (
              <EmptyState
                size="sm"
                icon="layers"
                title={t('substances.noParameters', 'Ushbu moddaga parametrlar kiritilmagan')}
                className="rounded-lg border border-dashed border-line-strong"
              />
            ) : (
              <DataTable columns={columns} rows={params} rowKey={(p) => p.id} />
            )}
          </section>
        </div>
      )}
    </Modal>
  );
}
