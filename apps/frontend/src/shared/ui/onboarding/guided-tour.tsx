'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { DEFAULT_TOUR_STEPS, type TourPlacement, type TourStep } from './tour-steps';

const FOCUSABLE =
  'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';
const STORAGE_PREFIX = 'my-finance:onboarding:v1:';
const CARD_WIDTH = 384;
const CARD_ESTIMATED_HEIGHT = 330;
const VIEWPORT_GAP = 16;
const TARGET_GAP = 14;
const SPOTLIGHT_PADDING = 6;
export const GUIDED_TOUR_RESTART_EVENT = 'my-finance:restart-tour';

type TourStatus = 'in-progress' | 'completed' | 'skipped';

interface StoredTourProgress {
  version: 1;
  status: TourStatus;
  stepIndex: number;
  updatedAt: string;
}

interface MeasuredRect {
  top: number;
  right: number;
  bottom: number;
  left: number;
  width: number;
  height: number;
}

interface ViewportSize {
  width: number;
  height: number;
}

export interface GuidedTourProps {
  /** User id or e-mail. It becomes part of the local persistence key. */
  userKey: string;
  steps?: readonly TourStep[];
  enabled?: boolean;
  onComplete?: () => void;
  onSkip?: () => void;
  onStepChange?: (step: TourStep, index: number) => void;
}

/** Exposed so Settings can offer “Refazer tutorial” without knowing storage details. */
export function getTourStorageKey(userKey: string): string {
  return `${STORAGE_PREFIX}${userKey.trim().toLocaleLowerCase('pt-BR')}`;
}

export function clearTourProgress(userKey: string): void {
  if (typeof window === 'undefined' || !userKey.trim()) return;
  try {
    window.localStorage.removeItem(getTourStorageKey(userKey));
  } catch {
    // Browsers may disable storage. The tour still works for the current page.
  }
}

export function restartTour(userKey: string): void {
  if (typeof window === 'undefined' || !userKey.trim()) return;
  clearTourProgress(userKey);
  window.dispatchEvent(new CustomEvent(GUIDED_TOUR_RESTART_EVENT, { detail: userKey }));
}

function readProgress(userKey: string, stepCount: number): StoredTourProgress | null {
  if (typeof window === 'undefined' || !userKey.trim()) return null;
  try {
    const raw = window.localStorage.getItem(getTourStorageKey(userKey));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredTourProgress>;
    if (parsed.version !== 1 || !['in-progress', 'completed', 'skipped'].includes(parsed.status ?? '')) {
      return null;
    }
    const requestedIndex = Number.isInteger(parsed.stepIndex) ? (parsed.stepIndex as number) : 0;
    return {
      version: 1,
      status: parsed.status as TourStatus,
      stepIndex: Math.max(0, Math.min(requestedIndex, Math.max(0, stepCount - 1))),
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date(0).toISOString(),
    };
  } catch {
    return null;
  }
}

function writeProgress(userKey: string, status: TourStatus, stepIndex: number): void {
  if (typeof window === 'undefined' || !userKey.trim()) return;
  try {
    const progress: StoredTourProgress = {
      version: 1,
      status,
      stepIndex,
      updatedAt: new Date().toISOString(),
    };
    window.localStorage.setItem(getTourStorageKey(userKey), JSON.stringify(progress));
  } catch {
    // Storage is an enhancement, never a reason to block the application.
  }
}

function resolveTarget(selector: string): HTMLElement | null {
  try {
    const candidates = Array.from(document.querySelectorAll<HTMLElement>(selector));
    return (
      candidates.find((candidate) => {
        const rect = candidate.getBoundingClientRect();
        const style = window.getComputedStyle(candidate);
        return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
      }) ?? null
    );
  } catch {
    return null;
  }
}

function measure(element: HTMLElement): MeasuredRect {
  const rect = element.getBoundingClientRect();
  return {
    top: rect.top,
    right: rect.right,
    bottom: rect.bottom,
    left: rect.left,
    width: rect.width,
    height: rect.height,
  };
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const media = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!media) return;
    const update = () => setReduced(media.matches);
    update();
    media.addEventListener?.('change', update);
    return () => media.removeEventListener?.('change', update);
  }, []);

  return reduced;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), Math.max(minimum, maximum));
}

function pickPlacement(
  requested: TourPlacement,
  target: MeasuredRect,
  viewport: ViewportSize,
): Exclude<TourPlacement, 'auto' | 'center'> {
  if (requested !== 'auto' && requested !== 'center') return requested;
  if (viewport.height - target.bottom >= CARD_ESTIMATED_HEIGHT + TARGET_GAP) return 'bottom';
  if (target.top >= CARD_ESTIMATED_HEIGHT + TARGET_GAP) return 'top';
  if (viewport.width - target.right >= CARD_WIDTH + TARGET_GAP) return 'right';
  return 'left';
}

function getCardPosition(
  target: MeasuredRect | null,
  requested: TourPlacement,
  viewport: ViewportSize,
): { placement: TourPlacement; style: React.CSSProperties } {
  const width = Math.min(CARD_WIDTH, Math.max(0, viewport.width - VIEWPORT_GAP * 2));
  if (!target || requested === 'center') {
    return {
      placement: 'center',
      style: { left: '50%', top: '50%', width, transform: 'translate(-50%, -50%)' },
    };
  }

  if (viewport.width < 1024 || requested === 'top' || requested === 'bottom') {
    const spaceAbove = target.top - TARGET_GAP - VIEWPORT_GAP;
    const spaceBelow = viewport.height - target.bottom - TARGET_GAP - VIEWPORT_GAP;
    const placeAbove = viewport.width < 1024 ? spaceAbove >= spaceBelow : requested === 'top';
    return {
      placement: placeAbove ? 'top' : 'bottom',
      style: placeAbove
        ? {
            bottom: viewport.height - target.top + TARGET_GAP,
            left: VIEWPORT_GAP,
            maxHeight: Math.max(1, spaceAbove),
            width,
          }
        : {
            left: VIEWPORT_GAP,
            maxHeight: Math.max(1, spaceBelow),
            top: target.bottom + TARGET_GAP,
            width,
          },
    };
  }

  const placement = pickPlacement(requested, target, viewport);
  const centeredLeft = target.left + target.width / 2 - width / 2;
  const centeredTop = target.top + target.height / 2 - CARD_ESTIMATED_HEIGHT / 2;
  const maxLeft = viewport.width - width - VIEWPORT_GAP;
  const maxTop = viewport.height - CARD_ESTIMATED_HEIGHT - VIEWPORT_GAP;

  if (placement === 'top') {
    return {
      placement,
      style: {
        left: clamp(centeredLeft, VIEWPORT_GAP, maxLeft),
        top: clamp(target.top - CARD_ESTIMATED_HEIGHT - TARGET_GAP, VIEWPORT_GAP, maxTop),
        width,
      },
    };
  }
  if (placement === 'bottom') {
    return {
      placement,
      style: {
        left: clamp(centeredLeft, VIEWPORT_GAP, maxLeft),
        top: clamp(target.bottom + TARGET_GAP, VIEWPORT_GAP, maxTop),
        width,
      },
    };
  }
  if (placement === 'right') {
    return {
      placement,
      style: {
        left: clamp(target.right + TARGET_GAP, VIEWPORT_GAP, maxLeft),
        top: clamp(centeredTop, VIEWPORT_GAP, maxTop),
        width,
      },
    };
  }
  return {
    placement,
    style: {
      left: clamp(target.left - width - TARGET_GAP, VIEWPORT_GAP, maxLeft),
      top: clamp(centeredTop, VIEWPORT_GAP, maxTop),
      width,
    },
  };
}

export function GuidedTour({
  userKey,
  steps = DEFAULT_TOUR_STEPS,
  enabled = true,
  onComplete,
  onSkip,
  onStepChange,
}: GuidedTourProps) {
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [loadedUserKey, setLoadedUserKey] = useState('');
  const [targetRect, setTargetRect] = useState<MeasuredRect | null>(null);
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);
  const [viewport, setViewport] = useState<ViewportSize>({ width: 0, height: 0 });
  const panelRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const restoreFocusTo = useRef<HTMLElement | null>(null);
  const stepIndexRef = useRef(0);
  const titleId = useId();
  const descriptionId = useId();
  const reducedMotion = usePrefersReducedMotion();
  const currentStep = steps[stepIndex];
  stepIndexRef.current = stepIndex;

  useEffect(() => {
    const stored = readProgress(userKey, steps.length);
    setStepIndex(stored?.stepIndex ?? 0);
    setOpen(
      Boolean(
        enabled && userKey.trim() && steps.length > 0 && !['completed', 'skipped'].includes(stored?.status ?? ''),
      ),
    );
    setReady(true);
    setLoadedUserKey(userKey);
  }, [enabled, steps.length, userKey]);

  useEffect(() => {
    if (!ready || !open || loadedUserKey !== userKey) return;
    writeProgress(userKey, 'in-progress', stepIndex);
  }, [loadedUserKey, open, ready, stepIndex, userKey]);

  useEffect(() => {
    if (!open) return;
    const root = document.createElement('div');
    root.dataset.guidedTourPortal = 'true';
    document.body.append(root);
    setPortalRoot(root);
    return () => {
      root.remove();
    };
  }, [open]);

  const dismiss = useCallback(() => {
    writeProgress(userKey, 'skipped', stepIndexRef.current);
    setOpen(false);
    onSkip?.();
  }, [onSkip, userKey]);

  const complete = useCallback(() => {
    writeProgress(userKey, 'completed', stepIndexRef.current);
    setOpen(false);
    onComplete?.();
  }, [onComplete, userKey]);

  useEffect(() => {
    if (!open || !portalRoot) return;
    restoreFocusTo.current = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    const siblings = Array.from(document.body.children).filter((element) => element !== portalRoot);
    const previousSiblingState = siblings.map((element) => ({
      element: element as HTMLElement,
      inert: (element as HTMLElement).inert,
      ariaHidden: element.getAttribute('aria-hidden'),
    }));

    document.body.style.overflow = 'hidden';
    for (const sibling of previousSiblingState) {
      sibling.element.inert = true;
      sibling.element.setAttribute('aria-hidden', 'true');
    }

    const focusFrame = requestAnimationFrame(() => closeButtonRef.current?.focus());
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        dismiss();
        return;
      }
      if (event.key !== 'Tab') return;

      const panel = panelRef.current;
      if (!panel) return;
      const focusable = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (element) => element.getAttribute('aria-hidden') !== 'true',
      );
      if (focusable.length === 0) {
        event.preventDefault();
        panel.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || !panel.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !panel.contains(active))) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown, true);

    return () => {
      cancelAnimationFrame(focusFrame);
      document.removeEventListener('keydown', handleKeyDown, true);
      document.body.style.overflow = previousOverflow;
      for (const sibling of previousSiblingState) {
        sibling.element.inert = sibling.inert;
        if (sibling.ariaHidden === null) sibling.element.removeAttribute('aria-hidden');
        else sibling.element.setAttribute('aria-hidden', sibling.ariaHidden);
      }
      restoreFocusTo.current?.focus?.();
    };
  }, [dismiss, open, portalRoot]);

  useEffect(() => {
    if (!open || !currentStep || !portalRoot) return;
    onStepChange?.(currentStep, stepIndex);
    const target = resolveTarget(currentStep.target);
    let measuredTarget = target;
    let targetFrame: number | undefined;
    setTargetRect(target ? measure(target) : null);
    setViewport({ width: window.innerWidth, height: window.innerHeight });
    target?.scrollIntoView?.({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'center', inline: 'center' });

    const update = () => {
      const nextTarget = resolveTarget(currentStep.target);
      const targetJustMounted = nextTarget !== null && nextTarget !== measuredTarget;
      measuredTarget = nextTarget;
      setTargetRect(nextTarget ? measure(nextTarget) : null);
      setViewport({ width: window.innerWidth, height: window.innerHeight });
      if (targetJustMounted) {
        nextTarget.scrollIntoView?.({
          behavior: reducedMotion ? 'auto' : 'smooth',
          block: 'center',
          inline: 'center',
        });
        targetFrame = requestAnimationFrame(() => {
          const movedTarget = resolveTarget(currentStep.target);
          setTargetRect(movedTarget ? measure(movedTarget) : null);
        });
      }
    };
    let secondFrame: number | undefined;
    const firstFrame = requestAnimationFrame(() => {
      update();
      secondFrame = requestAnimationFrame(update);
    });
    const observer = new MutationObserver(update);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      cancelAnimationFrame(firstFrame);
      if (secondFrame !== undefined) cancelAnimationFrame(secondFrame);
      if (targetFrame !== undefined) cancelAnimationFrame(targetFrame);
      observer.disconnect();
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [currentStep, onStepChange, open, portalRoot, reducedMotion, stepIndex]);

  const position = useMemo(
    () => getCardPosition(targetRect, currentStep?.placement ?? 'auto', viewport),
    [currentStep?.placement, targetRect, viewport],
  );

  if (!ready || loadedUserKey !== userKey || !open || !portalRoot || !currentStep) return null;

  const isFirst = stepIndex === 0;
  const isLast = stepIndex === steps.length - 1;
  const progress = Math.round(((stepIndex + 1) / steps.length) * 100);
  const spotlightStyle: React.CSSProperties | undefined = targetRect
    ? {
        top: Math.max(4, targetRect.top - SPOTLIGHT_PADDING),
        left: Math.max(4, targetRect.left - SPOTLIGHT_PADDING),
        width: targetRect.width + SPOTLIGHT_PADDING * 2,
        height: targetRect.height + SPOTLIGHT_PADDING * 2,
        boxShadow: '0 0 0 9999px rgba(5, 5, 30, 0.78)',
      }
    : undefined;

  return createPortal(
    <div className="pointer-events-none fixed inset-0 z-[100]" data-testid="guided-tour-layer">
      {spotlightStyle ? (
        <div
          aria-hidden="true"
          data-testid="tour-spotlight"
          className="fixed rounded-xl border-2 border-muted-primary transition-all duration-200 motion-reduce:transition-none"
          style={spotlightStyle}
        />
      ) : (
        <div aria-hidden="true" data-testid="tour-scrim" className="fixed inset-0 bg-scrim" />
      )}

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
        data-tour-position={position.placement}
        className="pointer-events-auto fixed max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-2xl border border-border-strong bg-layer01 p-5 text-foreground shadow-2xl outline-none transition-[top,left,bottom,transform] duration-200 motion-reduce:transition-none"
        style={position.style}
      >
        <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
          {currentStep.title}. {currentStep.description}. Passo {stepIndex + 1} de {steps.length}.
        </p>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Passo {stepIndex + 1} de {steps.length}
            </p>
            <h2 id={titleId} className="mt-2 text-lg font-semibold leading-tight">
              {currentStep.title}
            </h2>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={dismiss}
            className="-m-2 shrink-0 rounded-lg p-2 text-muted-foreground transition hover:bg-layer02 hover:text-foreground"
          >
            <span aria-hidden="true" className="text-lg leading-none">
              ×
            </span>
            <span className="sr-only">Fechar tutorial</span>
          </button>
        </div>

        <p id={descriptionId} className="mt-3 text-sm leading-relaxed text-muted-foreground">
          {currentStep.description}
        </p>

        <div className="mt-5">
          <div className="mb-2 flex items-center justify-between gap-3 text-xs text-muted-foreground">
            <span>Progresso do tutorial</span>
            <span>{progress}%</span>
          </div>
          <div
            role="progressbar"
            aria-label="Progresso do tutorial"
            aria-valuemin={0}
            aria-valuemax={steps.length}
            aria-valuenow={stepIndex + 1}
            className="h-1.5 overflow-hidden rounded-full bg-layer03"
          >
            <div
              aria-hidden="true"
              className="h-full rounded-full bg-primary transition-[width] duration-200 motion-reduce:transition-none"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
          <button
            type="button"
            onClick={dismiss}
            className="rounded-lg px-2 py-2 text-sm font-medium text-muted-foreground transition hover:bg-layer02 hover:text-foreground"
          >
            Pular tutorial
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setStepIndex((index) => Math.max(0, index - 1))}
              disabled={isFirst}
              className="rounded-full border border-border-strong bg-layer02 px-4 py-2 text-sm font-medium transition hover:bg-layer03 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Anterior
            </button>
            <button
              type="button"
              onClick={() => (isLast ? complete() : setStepIndex((index) => Math.min(steps.length - 1, index + 1)))}
              className="rounded-full bg-primary px-4 py-2 text-sm font-semibold transition hover:bg-muted-primary"
            >
              {isLast ? 'Concluir' : 'Próximo'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    portalRoot,
  );
}
