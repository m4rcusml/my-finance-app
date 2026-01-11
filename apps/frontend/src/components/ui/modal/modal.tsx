'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export function Modal({ isOpen, onClose, title, children }: ModalProps) {
  const [isMounted, setIsMounted] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isMounted) return null;

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <div
        ref={overlayRef}
        className="fixed inset-0 bg-background/80 backdrop-blur-sm transition-all animate-in fade-in-0"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className="relative w-full max-w-lg transform overflow-hidden rounded-3xl bg-layer01 p-6 shadow-xl transition-all animate-in zoom-in-95 sm:p-8"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <div className="flex items-center justify-between mb-6">
          <h2 id="modal-title" className="text-xl font-semibold text-foreground">
            {title}
          </h2>
          <Button tone="layer02" size="small" onClick={onClose} className="p-2!">
            <span className="text-lg leading-none">×</span>
            <span className="sr-only">Fechar</span>
          </Button>
        </div>
        <div>{children}</div>
      </div>
    </div>,
    document.body,
  );
}
