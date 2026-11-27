import { type FormEvent, useEffect, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { useEquipmentQuery, useSaveNdMutation } from '@/hooks/useP17';
import { useRegistryChemistsQuery } from '@/hooks/useRegistry';
import { errorMessage } from '@/lib/queryClient';
import type { NdDto } from '@/types/p17';
import { Alert, Button, DatePicker, FormField, Input, Modal, Select } from '@/ui';

/**
 * D-176 + P18 (D-184): ND yaratish/tahrirlash — kod, nom, versiya va metadata
 * (modda nomi, seriya, hujjat sanasi, kimyogar, apparat; hammasi ixtiyoriy).
 */
export function NdFormModal({
  open,
  onClose,
  nd,
}: {
  open: boolean;
  onClose: () => void;
  /** Berilsa — tahrirlash (PUT /nd/:id). */
  nd?: NdDto | null;
}) {
  const { t } = useTranslation();
  const formId = useId();
  const navigate = useNavigate();
  const save = useSaveNdMutation();
  const { data: chemists = [] } = useRegistryChemistsQuery();
  const { data: equipment } = useEquipmentQuery({ limit: 100 });
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [version, setVersion] = useState('');
  const [substanceName, setSubstanceName] = useState('');
  const [series, setSeries] = useState('');
  const [docDate, setDocDate] = useState('');
  const [chemistId, setChemistId] = useState('');
  const [equipmentId, setEquipmentId] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setCode(nd?.code ?? '');
    setName(nd?.name ?? '');
    setVersion(nd?.version ?? '');
    setSubstanceName(nd?.substanceName ?? '');
    setSeries(nd?.series ?? '');
    setDocDate(nd?.docDate ?? '');
    setChemistId(nd?.chemistId ?? '');
    setEquipmentId(nd?.equipmentId ?? '');
    setError(null);
  }, [open, nd]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !name.trim()) {
      setError(t('nd.errors.required'));
      return;
    }
    try {
      const saved = await save.mutateAsync({
        id: nd?.id,
        input: {
          code: code.trim(),
          name: name.trim(),
          version: version.trim() || null,
          substanceName: substanceName.trim() || null,
          series: series.trim() || null,
          docDate: docDate || null,
          chemistId: chemistId || null,
          equipmentId: equipmentId || null,
        },
      });
      onClose();
      if (!nd) navigate(`/nd/${saved.id}`);
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={nd ? t('nd.edit') : t('nd.create')}
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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField id="nd-code" label={t('nd.code')} required>
            <Input value={code} onChange={(e) => setCode(e.target.value)} />
          </FormField>
          <FormField id="nd-version" label={t('nd.version')}>
            <Input value={version} onChange={(e) => setVersion(e.target.value)} />
          </FormField>
        </div>
        <FormField id="nd-name" label={t('nd.name')} required>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </FormField>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField id="nd-substance" label={t('nd.meta.substanceName')}>
            <Input
              value={substanceName}
              maxLength={500}
              onChange={(e) => setSubstanceName(e.target.value)}
            />
          </FormField>
          <FormField id="nd-series" label={t('nd.meta.series')}>
            <Input value={series} maxLength={100} onChange={(e) => setSeries(e.target.value)} />
          </FormField>
          <FormField id="nd-doc-date" label={t('nd.meta.docDate')}>
            <DatePicker value={docDate} onChange={setDocDate} />
          </FormField>
          <FormField id="nd-chemist" label={t('nd.meta.chemist')}>
            <Select
              options={[
                { value: '', label: t('nd.meta.notSet') },
                ...chemists.map((c) => ({ value: c.id, label: c.fullName })),
              ]}
              value={chemistId}
              onChange={setChemistId}
            />
          </FormField>
          <FormField id="nd-equipment" label={t('nd.meta.equipment')} className="sm:col-span-2">
            <Select
              options={[
                { value: '', label: t('nd.meta.notSet') },
                ...(equipment?.data ?? []).map((eq) => ({
                  value: eq.id,
                  label: `${eq.name} (${eq.category})`,
                })),
              ]}
              value={equipmentId}
              onChange={setEquipmentId}
            />
          </FormField>
        </div>
      </form>
    </Modal>
  );
}
