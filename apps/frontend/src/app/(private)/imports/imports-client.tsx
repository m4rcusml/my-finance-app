'use client';

import { ImportHistory } from '@/features/imports/import-history';
import { ImportWizard } from '@/features/imports/import-wizard';
import { PageHeader } from '@/shared/ui/app-shell';

export function ImportsClient() {
  return (
    <>
      <PageHeader
        title="Importações"
        description="Traga o extrato do seu banco em CSV, OFX ou XLSX. Você confere linha a linha antes de qualquer coisa ser gravada."
      />
      <ImportWizard />
      <ImportHistory />
    </>
  );
}
