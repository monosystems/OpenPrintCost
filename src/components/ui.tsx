import { useEffect, useId, type ComponentProps, type ReactNode } from "react";
import { useStrings } from "../i18n";
import { CheckIcon, SpinnerIcon, XIcon } from "./icons";

/** Small UI kit for master-data management (dark theme). */

const inputClass =
  "h-9 w-full rounded-control border border-line-strong bg-canvas px-3 text-sm " +
  "text-ink placeholder:text-ink-faint transition-colors hover:border-ink-faint " +
  "focus:border-brand";

const labelClass =
  "mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-muted";

export function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="block">
      <label className="block">
        <span className={labelClass}>{label}</span>
        {children}
      </label>
      {error ? (
        <span role="alert" className="mt-1.5 block text-xs text-danger">
          {error}
        </span>
      ) : null}
    </div>
  );
}

/** Visual grouping inside long forms; the fields themselves stay shared inputs. */
export function FormSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <div className="mb-4 flex items-center gap-3">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
          {title}
        </h3>
        <span aria-hidden="true" className="h-px flex-1 bg-line" />
      </div>
      {children}
    </section>
  );
}

export function TextInput({ className = "", ...props }: ComponentProps<"input">) {
  return <input {...props} className={`${inputClass} ${className}`} />;
}

export function DecimalInput({
  value,
  onChange,
  className = "",
  ...rest
}: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
} & Omit<ComponentProps<"input">, "value" | "onChange">) {
  return (
    <input
      {...rest}
      inputMode="decimal"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className={`${inputClass} text-right tabular-nums ${className}`}
      placeholder="0.00"
    />
  );
}

export function Select({
  value,
  onChange,
  options,
  className = "",
  ...rest
}: {
  value: string;
  onChange: (value: string) => void;
  options: ReadonlyArray<{ value: string; label: string }>;
  className?: string;
} & Omit<ComponentProps<"select">, "value" | "onChange">) {
  return (
    <select
      {...rest}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className={`${inputClass} ${className}`}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

const buttonBase =
  "inline-flex h-9 items-center justify-center gap-2 rounded-control px-3.5 text-sm font-medium " +
  "transition-colors disabled:cursor-not-allowed disabled:opacity-50";

type ButtonProps = ComponentProps<"button"> & { loading?: boolean };

function ButtonContent({ loading, children }: { loading?: boolean; children: ReactNode }) {
  return (
    <>
      {loading ? <SpinnerIcon className="h-4 w-4" /> : null}
      {children}
    </>
  );
}

export function PrimaryButton({ loading, children, className = "", ...props }: ButtonProps) {
  return (
    <button
      {...props}
      disabled={props.disabled || loading}
      className={`${buttonBase} bg-brand text-white shadow-[inset_0_1px_0_rgb(255_255_255_/_0.14)] hover:bg-brand-hover ${className}`}
    >
      <ButtonContent loading={loading}>{children}</ButtonContent>
    </button>
  );
}

export function SecondaryButton({ loading, children, className = "", ...props }: ButtonProps) {
  return (
    <button
      {...props}
      disabled={props.disabled || loading}
      className={`${buttonBase} border border-line-strong bg-raised text-ink hover:bg-raised-hover ${className}`}
    >
      <ButtonContent loading={loading}>{children}</ButtonContent>
    </button>
  );
}

export function DangerButton({ loading, children, className = "", ...props }: ButtonProps) {
  return (
    <button
      {...props}
      disabled={props.disabled || loading}
      className={`${buttonBase} border border-danger/30 bg-danger-soft text-danger hover:bg-danger-soft/80 ${className}`}
    >
      <ButtonContent loading={loading}>{children}</ButtonContent>
    </button>
  );
}

export function GhostButton({ loading, children, className = "", ...props }: ButtonProps) {
  return (
    <button
      {...props}
      disabled={props.disabled || loading}
      className={`${buttonBase} text-ink-muted hover:bg-raised hover:text-ink ${className}`}
    >
      <ButtonContent loading={loading}>{children}</ButtonContent>
    </button>
  );
}

export function DangerGhostButton({ loading, children, className = "", ...props }: ButtonProps) {
  return (
    <button
      {...props}
      disabled={props.disabled || loading}
      className={`${buttonBase} text-danger hover:bg-danger-soft ${className}`}
    >
      <ButtonContent loading={loading}>{children}</ButtonContent>
    </button>
  );
}

export function IconButton({
  label,
  danger = false,
  className = "",
  children,
  ...props
}: ComponentProps<"button"> & { label: string; danger?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      {...props}
      className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-raised hover:text-ink ${
        danger ? "hover:text-danger" : ""
      } ${className}`}
    >
      {children}
    </button>
  );
}

export function Checkbox({
  label,
  checked,
  onChange,
  disabled = false,
}: {
  label: ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className="relative flex cursor-pointer items-center gap-2.5 text-sm text-ink">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="peer absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
      />
      <span
        aria-hidden="true"
        className="grid h-4 w-4 shrink-0 place-items-center rounded-[4px] border border-line-strong bg-canvas transition-colors peer-checked:border-brand peer-checked:bg-brand peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus peer-disabled:opacity-50 peer-checked:[&>svg]:opacity-100"
      >
        <CheckIcon className="h-3 w-3 text-white opacity-0 transition-opacity" />
      </span>
      <span className={disabled ? "text-ink-faint" : undefined}>{label}</span>
    </label>
  );
}

export function EmptyState({
  message,
  title,
  description,
  icon,
  action,
}: {
  message?: string;
  title?: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-card border border-dashed border-line-strong bg-surface/40 px-6 py-12 text-center">
      {icon ? (
        <div className="mx-auto mb-4 grid h-10 w-10 place-items-center rounded-xl border border-line bg-raised text-ink-muted">
          {icon}
        </div>
      ) : null}
      {title ? <p className="text-sm font-semibold text-ink">{title}</p> : null}
      <p className={`text-sm text-ink-muted ${title ? "mt-1" : ""}`}>{description ?? message}</p>
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function ErrorBanner({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  const t = useStrings();
  return (
    <div
      role="alert"
      className="mb-4 flex items-start justify-between gap-4 rounded-control border border-danger/30 bg-danger-soft/60 px-4 py-3"
    >
      <p className="text-sm text-danger">{message}</p>
      <IconButton label={t.errors.dismiss} onClick={onDismiss} className="-my-1">
        <XIcon />
      </IconButton>
    </div>
  );
}

/** Fixed, self-dismissing status message for import/export feedback. */
export function Toast({
  message,
  tone = "info",
  onDismiss,
}: {
  message: string;
  tone?: "info" | "success" | "warning";
  onDismiss: () => void;
}) {
  const t = useStrings();

  useEffect(() => {
    const timer = window.setTimeout(onDismiss, 5000);
    return () => window.clearTimeout(timer);
  }, [message, onDismiss]);

  const tones = {
    info: "border-brand/30 bg-brand-soft text-brand-ink",
    success: "border-accent/30 bg-accent-soft text-accent",
    warning: "border-warning/30 bg-warning-soft text-warning",
  } as const;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed bottom-6 right-6 z-40 flex max-w-sm items-start gap-3 rounded-card border px-4 py-3 shadow-2xl ${tones[tone]}`}
    >
      <p className="text-sm">{message}</p>
      <IconButton
        label={t.common.close}
        onClick={onDismiss}
        className="-my-1 -mr-2 h-7 w-7 text-current hover:bg-black/20"
      >
        <XIcon className="h-3.5 w-3.5" />
      </IconButton>
    </div>
  );
}

export function Modal({
  title,
  description,
  footer,
  onClose,
  children,
}: {
  title: string;
  description?: string;
  footer?: ReactNode;
  onClose: () => void;
  children: ReactNode;
}) {
  const t = useStrings();
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-card border border-line-strong bg-raised shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-5">
          <div className="min-w-0">
            <h2 id={titleId} className="text-base font-semibold tracking-tight text-ink">
              {title}
            </h2>
            {description ? (
              <p id={descriptionId} className="mt-1 text-sm text-ink-muted">
                {description}
              </p>
            ) : null}
          </div>
          <IconButton label={t.common.close} onClick={onClose} className="-mr-1 -mt-0.5">
            <XIcon />
          </IconButton>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-6">{children}</div>
        {footer ? (
          <div className="border-t border-line bg-surface/40 px-6 py-4">{footer}</div>
        ) : null}
      </div>
    </div>
  );
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const t = useStrings();
  return (
    <Modal title={title} onClose={onCancel}>
      <p className="mb-6 text-sm text-ink-muted">{message}</p>
      <div className="flex justify-end gap-3">
        <SecondaryButton type="button" onClick={onCancel}>
          {t.common.cancel}
        </SecondaryButton>
        <DangerButton type="button" onClick={onConfirm}>
          {confirmLabel}
        </DangerButton>
      </div>
    </Modal>
  );
}
