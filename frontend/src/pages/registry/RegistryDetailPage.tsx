import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router';
import { useFinalizeProtocolMutation, useProtocolsBySampleQuery } from '@/hooks/useProtocols';
import { useRegistryItemQuery } from '@/hooks/useRegistry';
import { formatDate } from '@/lib/date';
import { useAuthStore } from '@/store/authStore';
import {
  Button,
  ButtonLink,
  Card,
  DescriptionList,
  DetailLayout,
  EmptyState,
  PageHeader,
  PageSkeleton,
} from '@/ui';
import { SampleTrackingTimeline } from '../samples/SampleTrackingTimeline';
import { SampleTypeBadge } from '../samples/SampleTypeBadge';
import { RegistryDeleteModal } from './RegistryDeleteModal';
import { canDeleteFromRegistry, downloadRegistryFile } from './registryActions';

export function RegistryDetailPage() {
  const { t } = useTranslation();
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const role = useAuthStore((s) => s.user?.role);
  const { data: item, isLoading, isError } = useRegistryItemQuery(id);
  const { data: protocols } = useProtocolsBySampleQuery(id);
  const finalizeMutation = useFinalizeProtocolMutation(id);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const approvedProtocol = protocols?.find((p) => p.status === 'approved');
  const isDirector = role === 'director';

  if (isLoading) return <PageSkeleton variant="detail" />;

  if (isError || !item) {
    return (
      <EmptyState
        titleAs="h1"
        icon="clipboard"
        title={t('registry.notFound')}
        action={
          <ButtonLink to="/registry" leftIcon="arrow-left">
            {t('registry.backToList')}
          </ButtonLink>
        }
        className="py-20"
      />
    );
  }

  return (
    <>
      <PageHeader
        back={{ to: '/registry', label: t('registry.backToList') }}
        title={item.substanceName}
        description={t('pages.registryDetail')}
        meta={<SampleTypeBadge type={item.type} />}
        actions={
          <>
            {item.downloadKind && (
              <Button
                variant="secondary"
                leftIcon="download"
                onClick={() => void downloadRegistryFile(item.id)}
              >
                {item.downloadKind === 'passport'
                  ? t('registry.downloadPassport')
                  : t('registry.downloadProtocol')}
              </Button>
            )}
            {isDirector && approvedProtocol && (
              <Button
                leftIcon="shield-check"
                loading={finalizeMutation.isPending}
                onClick={() => finalizeMutation.mutate(approvedProtocol.id)}
              >
                {t('protocols.finalize', 'Yakunlash')}
              </Button>
            )}
            {canDeleteFromRegistry(role) && (
              <Button variant="danger-ghost" leftIcon="trash" onClick={() => setDeleteOpen(true)}>
                {t('registry.delete')}
              </Button>
            )}
          </>
        }
      />

      <DetailLayout
        aside={
          <Card title={t('samples.timelineTitle')}>
            <SampleTrackingTimeline tracking={item.tracking} />
          </Card>
        }
      >
        <Card>
          <DescriptionList
            items={[
              { label: t('registry.columns.type'), value: <SampleTypeBadge type={item.type} /> },
              { label: t('registry.columns.serialNumber'), value: item.serialNumber, mono: true },
              { label: t('registry.columns.lotNumber'), value: item.lotNumber, mono: true },
              { label: t('samples.quantity'), value: item.quantity },
              { label: t('samples.manufacturer'), value: item.manufacturer },
              { label: t('registry.columns.approvedAt'), value: formatDate(item.approvedAt) },
            ]}
          />
        </Card>
      </DetailLayout>

      <RegistryDeleteModal
        sample={deleteOpen ? item : null}
        onClose={() => setDeleteOpen(false)}
        onDeleted={() => void navigate('/registry')}
      />
    </>
  );
}
