'use client';

/**
 * The three-step progress indicator for the import flow.
 *
 * Plain text, not icons: the current step is conveyed by `aria-current="step"`
 * and by the visible number/label, never by colour alone.
 */

export type ImportStep = 'upload' | 'preview' | 'result';

const STEPS: { id: ImportStep; label: string; hint: string }[] = [
  { id: 'upload', label: 'Enviar arquivo', hint: 'Escolha o extrato e a origem' },
  { id: 'preview', label: 'Pré-visualizar', hint: 'Confira as linhas e o destino' },
  { id: 'result', label: 'Confirmar', hint: 'Veja o que foi importado' },
];

const ORDER: Record<ImportStep, number> = { upload: 0, preview: 1, result: 2 };

export function ImportStepper({ current }: { current: ImportStep }) {
  const currentIndex = ORDER[current];

  return (
    <ol className="mb-6 flex flex-col gap-2 sm:flex-row sm:gap-3">
      {STEPS.map((step, index) => {
        const state = index < currentIndex ? 'done' : index === currentIndex ? 'current' : 'todo';
        return (
          <li
            key={step.id}
            aria-current={state === 'current' ? 'step' : undefined}
            className={`flex flex-1 items-start gap-3 rounded-xl border p-3 ${
              state === 'current'
                ? 'border-border-strong bg-layer02'
                : 'border-border bg-layer01'
            }`}
          >
            <span
              className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
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
              <span className="block text-xs text-muted-foreground">{step.hint}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
