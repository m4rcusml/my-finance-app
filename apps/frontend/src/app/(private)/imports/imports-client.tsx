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
        description="Revise cada linha antes de levar o extrato para sua conta."
        actions={
          <a
            href="#import-history-heading"
            className="rounded-xl border border-border bg-layer02 px-5 py-3 text-sm font-semibold hover:bg-layer03"
          >
            Ver histórico
          </a>
        }
      />
      <ImportWizard />
      <ImportHistory />
    </>
  );
}
