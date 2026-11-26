import { type FormEvent, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useReviewReagentMutation } from '@/hooks/useReagents';
import { errorMessage } from '@/lib/queryClient';
import { useAuthStore } from '@/store/authStore';
import type { ReagentDto } from '@/types';
import { Alert, Button, FormField, Modal, notify, Textarea } from '@/ui';

const REVIEWER_ROLES = new Set(['chemist', 'lab_head']);

/**
 * D-169: reaktiv tasdiqlash holati va amallari. Tasdiqlash faqat chemist/lab_head uchun va
 * kiritgan shaxsning o'ziga ko'rinmaydi (backend ham 403 qaytaradi). Tasdiqlangan reaktivda panel yo'q.
 */
export function ReagentApprovalPanel({ reagent }: { reagent: ReagentDto }) {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const review = useReviewReagentMutation();
  const formId = useId();
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState<string | null>(null);

  const status = reagent.approvalStatus ?? 'approved';
  if (status === 'approved') return null;

  if (status === 'rejected') {
    return (
      <Alert tone="danger" title={t('reagents.approval.rejectedTitle', 'Reaktiv rad etilgan')}>
        {reagent.rejectionReason}
      </Alert>
    );
  }

  const canReview = !!user && REVIEWER_ROLES.has(user.role) && reagent.createdBy !== user.id;

  const approve = async () => {
    try {
      await review.mutateAsync({ id: reagent.id, decision: 'approve' });
      notify.success(t('reagents.approval.approvedToast', 'Reaktiv tasdiqlandi'));
    } catch (err) {
      notify.error(errorMessage(err));
    }
  };

  const submitReject = async (e: FormEvent) => {
    e.preventDefault();
    if (reason.trim().length < 5) {
      setReasonError(
        t(
          'reagents.approval.reasonMin',
          'Rad etish sababi kamida 5 ta belgidan iborat bo‘lishi shart',
        ),
      );
      return;
    }
    try {
      await review.mutateAsync({ id: reagent.id, decision: 'reject', reason: reason.trim() });
      setRejectOpen(false);
      setReason('');
      notify.success(t('reagents.approval.rejectedToast', 'Reaktiv rad etildi'));
    } catch (err) {
      setReasonError(errorMessage(err));
    }
  };

  return (
    <>
      <Alert
        tone="warning"
        title={t('reagents.approval.pendingTitle', 'Reaktiv tasdiqlashni kutmoqda')}
        action={
          canReview ? (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => void approve()} loading={review.isPending}>
                {t('reagents.approval.approve', 'Tasdiqlash')}
              </Button>
              <Button
                size="sm"
                variant="danger-ghost"
                onClick={() => {
                  setReasonError(null);
                  setRejectOpen(true);
                }}
                disabled={review.isPending}
              >
                {t('reagents.approval.reject', 'Rad etish')}
              </Button>
            </div>
          ) : undefined
        }
      >
        {t(
          'reagents.approval.pendingHint',
          'Kimyogar yoki laboratoriya mudiri tasdiqlamaguncha reaktivdan sarf qayd etilmaydi.',
        )}
      </Alert>

      <Modal
        open={rejectOpen}
        onClose={() => setRejectOpen(false)}
        title={t('reagents.approval.rejectTitle', 'Reaktivni rad etish')}
        footer={
          <>
            <Button variant="secondary" onClick={() => setRejectOpen(false)}>
              {t('common.cancel', 'Bekor qilish')}
            </Button>
            <Button type="submit" form={formId} variant="danger" loading={review.isPending}>
              {t('reagents.approval.reject', 'Rad etish')}
            </Button>
          </>
        }
      >
        <form id={formId} onSubmit={(e) => void submitReject(e)} noValidate>
          <FormField
            id="reagent-reject-reason"
            label={t('reagents.approval.reason', 'Rad etish sababi')}
            required
            error={reasonError}
          >
            <Textarea
              rows={3}
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                if (reasonError) setReasonError(null);
              }}
            />
          </FormField>
        </form>
      </Modal>
    </>
  );
}
