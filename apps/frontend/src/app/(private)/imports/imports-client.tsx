'use client';

import { ImportHistory } from '@/features/imports/import-history';
import { ImportWizard } from '@/features/imports/import-wizard';
import { PageHeader } from '@/shared/ui/app-shell';

export function ImportsClient() {
  return (
    <>
      <PageHeader
        eyebrow="Organização"
        title="Importações"
        description="Traga seu extrato em CSV, OFX ou XLSX e revise cada linha antes de salvar."
      />
      <ImportWizard />
      <ImportHistory />
    </>
  );
}
