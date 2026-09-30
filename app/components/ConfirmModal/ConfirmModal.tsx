'use client';

import React, { useEffect } from 'react';
import styles from './ConfirmModal.module.css';

export interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string | null;
  variant?: 'danger' | 'warning' | 'accent' | 'info';
  isLoading?: boolean;
  onConfirm?: () => void | Promise<void>;
  onCancel?: () => void;
  children?: React.ReactNode;
}

export default function ConfirmModal({
  isOpen,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'danger',
  isLoading = false,
  onConfirm,
  onCancel,
  children,
}: ConfirmModalProps) {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isLoading && onCancel) {
        onCancel();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen, isLoading, onCancel]);

  if (!isOpen) return null;

  const renderIcon = () => {
    switch (variant) {
      case 'danger':
        return (
          <div className={`${styles.iconWrapper} ${styles.iconDanger}`}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
        );
      case 'warning':
        return (
          <div className={`${styles.iconWrapper} ${styles.iconWarning}`}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </div>
        );
      case 'accent':
        return (
          <div className={`${styles.iconWrapper} ${styles.iconAccent}`}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
        );
      case 'info':
      default:
        return (
          <div className={`${styles.iconWrapper} ${styles.iconInfo}`}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
          </div>
        );
    }
  };

  const getConfirmBtnClass = () => {
    switch (variant) {
      case 'danger':
        return styles.btnConfirmDanger;
      case 'warning':
        return styles.btnConfirmWarning;
      case 'accent':
        return styles.btnConfirmAccent;
      case 'info':
      default:
        return styles.btnConfirmInfo;
    }
  };

  return (
    <div
      className={styles.overlay}
      onClick={(e) => {
        if (e.target === e.currentTarget && !isLoading && onCancel) {
          onCancel();
        }
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div className={styles.modalCard}>
        {onCancel && (
          <button
            type="button"
            className={styles.closeBtn}
            onClick={onCancel}
            disabled={isLoading}
            aria-label="Close dialog"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}

        <div className={styles.header}>
          {renderIcon()}
          <div className={styles.headerText}>
            <h3 id="modal-title" className={styles.title}>
              {title}
            </h3>
            {message && <p className={styles.message}>{message}</p>}
          </div>
        </div>

        {children && <div className={styles.contentBody}>{children}</div>}

        <div className={styles.footer}>
          {cancelText && onCancel && (
            <button
              type="button"
              className={styles.btnCancel}
              onClick={onCancel}
              disabled={isLoading}
            >
              {cancelText}
            </button>
          )}

          {onConfirm && (
            <button
              type="button"
              className={`${styles.btnConfirmBase} ${getConfirmBtnClass()}`}
              onClick={onConfirm}
              disabled={isLoading}
            >
              {isLoading && <span className={styles.spinner} />}
              {confirmText}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
