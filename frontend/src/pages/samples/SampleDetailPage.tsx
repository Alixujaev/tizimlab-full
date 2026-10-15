import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router';
import { useSampleQuery } from '@/hooks/useSamples';
import { formatDate, formatDateTime } from '@/lib/date';
import { useAuthStore } from '@/store/authStore';
import {
  Alert,
  Badge,
  Button,
  ButtonLink,
  Card,
  DescriptionList,
  DetailLayout,
  EmptyState,
  PageHeader,
  PageSkeleton,
} from '@/ui';
import { PassportSection } from './PassportSection';
import { ProtocolSection } from './ProtocolSection';
import { SampleAssignModal } from './SampleAssignModal';
import { SampleResumeModal } from './SampleResumeModal';
import { SampleStatusBadge } from './SampleStatusBadge';
import { SampleStopModal } from './SampleStopModal';
import { SampleTrackingTimeline } from './SampleTrackingTimeline';
import { SampleTypeBadge } from './SampleTypeBadge';

const ASSIGNABLE = ['pending_assignment', 'in_progress', 'stopped', 'rejected'];

const dateTime = (iso: string | null | undefined) => (iso ? formatDateTime(iso) : null);

export function SampleDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const user = useAuthStore((s) => s.user);
  const { data: sample, isLoading, isError } = useSampleQuery(id ?? '');

  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [stopModalOpen, setStopModalOpen] = useState(false);
  const [resumeModalOpen, setResumeModalOpen] = useState(false);

  if (isLoading) return <PageSkeleton variant="detail" />;

  if (isError || !sample) {
    return (
      <EmptyState
        titleAs="h1"
        icon="flask"
        title={t('samples.notFound', 'Namuna topilmadi')}
        description={t(
          'samples.notFoundMessage',
          'Siz qidirayotgan namuna mavjud emas yoki sizda uni ko‘rish huquqi yo‘q.',
        )}
        action={
          <ButtonLink to="/samples" leftIcon="arrow-left">
            {t('samples.backToList', 'Namunalar ro‘yxatiga qaytish')}
          </ButtonLink>
        }
        className="py-20"
      />
    );
  }

  // Rolga oid ruxsatlar (spec §1, §3)
  const isLabHead = user?.role === 'lab_head';
  const isAssignedChemist =
    user?.role === 'chemist' && Boolean(user?.id && sample.assignedTo === user.id);
  // Biriktirish qoidalari (R-PASS-23, D-37, D-39)
  const canAssign =
    isLabHead &&
    sample.type !== 'reagent' &&
    sample.type !== 'standard_substance' &&
    ASSIGNABLE.includes(sample.status);
  // To'xtatish / Davom ettirish qoidalari (D-36, D-38)
  const canStop = isAssignedChemist && sample.status === 'in_progress';
  const canResume = isAssignedChemist && sample.status === 'stopped';
  const assignedName = sample.assignedToName || sample.assigned_to_name;

  return (
    <>
      <PageHeader
        back={{ to: '/samples', label: t('samples.backToList', 'Namunalar ro‘yxatiga qaytish') }}
        title={sample.substanceName}
        meta={
          <>
            <SampleTypeBadge type={sample.type} />
            <SampleStatusBadge status={sample.status} />
          </>
        }
        actions={
          <>
            {canAssign && (
              <Button leftIcon="user" onClick={() => setAssignModalOpen(true)}>
                {sample.assignedTo
                  ? t('samples.reassignChemist', 'Qayta biriktirish')
                  : t('samples.assignChemist', 'Kimyogarga biriktirish')}
              </Button>
            )}
            {canStop && (
              <Button variant="danger" onClick={() => setStopModalOpen(true)}>
                {t('samples.stopAnalysis', 'Tahlilni to‘xtatish')}
              </Button>
            )}
            {canResume && (
              <Button onClick={() => setResumeModalOpen(true)}>
                {t('samples.resumeAnalysis', 'Tahlilni davom ettirish')}
              </Button>
            )}
          </>
        }
      />

      <DetailLayout
        aside={
          <Card title={t('samples.timelineTitle', 'Harakatlar tarixi')}>
            <SampleTrackingTimeline tracking={sample.tracking} />
          </Card>
        }
      >
        <Card title={t('samples.generalInfo', 'Asosiy ko‘rsatkichlar')}>
          <div className="flex flex-col gap-6">
            <DescriptionList
              items={[
                { label: t('samples.substanceName', 'Modda nomi'), value: sample.substanceName },
                {
                  label: t('samples.type', 'Namuna turi'),
                  value: <SampleTypeBadge type={sample.type} />,
                },
                {
                  label: t('samples.serialNumber', 'Seriya raqami'),
                  value: sample.serialNumber,
                  mono: true,
                },
                {
                  label: t('samples.lotNumber', 'Partiya (Lot) raqami'),
                  value: sample.lotNumber,
                  mono: true,
                },
                { label: t('samples.quantity', 'Miqdori'), value: sample.quantity },
                {
                  label: t('samples.manufacturer', 'Ishlab chiqaruvchi'),
                  value: sample.manufacturer,
                },
                {
                  label: t('samples.manufacturedAt', 'Ishlab chiqarilgan sana'),
                  value: sample.manufacturedAt ? formatDate(sample.manufacturedAt) : null,
                },
                {
                  label: t('samples.createdAt', 'Kiritilgan vaqt'),
                  value: dateTime(sample.createdAt),
                },
              ]}
            />
            <div className="border-t border-line pt-5">
              <h3 className="mb-4 text-sm font-semibold text-fg">
                {t('samples.analysisSchedule', 'Tahlil muddati va ijrochilar')}
              </h3>
              <DescriptionList
                items={[
                  {
                    label: t('samples.analysisStart', 'Tahlil boshlanishi'),
                    value: sample.analysisStart ? formatDate(sample.analysisStart) : null,
                  },
                  {
                    label: t('samples.analysisEnd', 'Tahlil tugashi'),
                    value: sample.analysisEnd ? formatDate(sample.analysisEnd) : null,
                  },
                  {
                    label: t('samples.assignedChemistLabel', 'Biriktirilgan kimyogar'),
                    value: assignedName ? <Badge tone="primary">{assignedName}</Badge> : null,
                  },
                  {
                    label: t('samples.assignedAt', 'Biriktirilgan sana'),
                    value: dateTime(sample.assignedAt),
                  },
                ]}
              />
            </div>
            {sample.stopReason && (
              <Alert tone="danger" title={t('samples.stopReason', 'To‘xtatish sababi')}>
                <p>{sample.stopReason}</p>
                {sample.stoppedAt && (
                  <p className="mt-1 text-xs">
                    {t('samples.stoppedAt', 'To‘xtatilgan vaqt')}: {dateTime(sample.stoppedAt)}
                  </p>
                )}
              </Alert>
            )}
            {sample.notes && (
              <div>
                <h3 className="mb-1.5 text-xs font-medium text-fg-muted">
                  {t('samples.notes', 'Qo‘shimcha izohlar')}
                </h3>
                <p className="whitespace-pre-line rounded-lg border border-line bg-surface-muted px-4 py-3 text-sm text-fg">
                  {sample.notes}
                </p>
              </div>
            )}
          </div>
        </Card>

        <ProtocolSection sample={sample} />
        <PassportSection sample={sample} />
      </DetailLayout>

      {canAssign && (
        <SampleAssignModal
          open={assignModalOpen}
          onClose={() => setAssignModalOpen(false)}
          sample={sample}
        />
      )}
      <SampleStopModal
        open={stopModalOpen}
        onClose={() => setStopModalOpen(false)}
        sample={sample}
      />
      <SampleResumeModal
        open={resumeModalOpen}
        onClose={() => setResumeModalOpen(false)}
        sample={sample}
      />
    </>
  );
}
