'use client';

/**
 * The three-step progress indicator for the import flow.
 *
 * Plain text, not icons: the current step is conveyed by `aria-current="step"`
 * and by the visible number/label, never by colour alone.
 */

export type ImportStep = 'upload' | 'preview' | 'result';

const STEPS: { id: ImportStep; label: string; hint: string }[] = [
  { id: 'upload', label: 'Arquivo', hint: 'Escolha o extrato e a origem' },
  { id: 'preview', label: 'Prévia', hint: 'Confira as linhas e o destino' },
  { id: 'result', label: 'Resultado', hint: 'Veja o que foi importado' },
];

const ORDER: Record<ImportStep, number> = { upload: 0, preview: 1, result: 2 };

export function ImportStepper({ current }: { current: ImportStep }) {
  const currentIndex = ORDER[current];

  return (
    <ol className="mb-6 grid grid-cols-3 gap-2 rounded-2xl border border-border bg-layer01 p-3 sm:p-4">
      {STEPS.map((step, index) => {
        const state = index < currentIndex ? 'done' : index === currentIndex ? 'current' : 'todo';
        return (
          <li
            key={step.id}
            aria-current={state === 'current' ? 'step' : undefined}
            className={`flex flex-1 flex-col items-center gap-2 rounded-xl p-2 sm:flex-row sm:gap-3 ${
              state === 'current' ? 'bg-layer02' : 'bg-layer01'
            }`}
          >
            <span
              className={`mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                state === 'todo' ? 'bg-layer03 text-muted-foreground' : 'bg-primary text-foreground'
              }`}
              aria-hidden="true"
            >
              {index + 1}
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-medium text-foreground">
                <span className="sr-only">{`Etapa ${index + 1} de ${STEPS.length}: `}</span>
                {step.label}
                {state === 'done' ? <span className="sr-only"> (concluída)</span> : null}
                {state === 'current' ? <span className="sr-only"> (etapa atual)</span> : null}
              </span>
              <span className="hidden text-xs text-muted-foreground sm:block">{step.hint}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
