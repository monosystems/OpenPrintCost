import type { ComponentProps, ReactNode } from "react";

/** Kleines UI-Kit für die Stammdatenverwaltung (dunkles Schema). */

const inputClass =
  "w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm " +
  "text-slate-100 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none";

const labelClass = "mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400";

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
    <label className="block">
      <span className={labelClass}>{label}</span>
      {children}
      {error ? (
        <span role="alert" className="mt-1 block text-xs text-red-400">
          {error}
        </span>
      ) : null}
    </label>
  );
}

export function TextInput(props: ComponentProps<"input">) {
  return <input {...props} className={inputClass} />;
}

export function DecimalInput({
  value,
  onChange,
  ...rest
}: {
  value: string;
  onChange: (value: string) => void;
} & Omit<ComponentProps<"input">, "value" | "onChange">) {
  return (
    <input
      {...rest}
      inputMode="decimal"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className={inputClass}
      placeholder="0.00"
    />
  );
}

export function Select({
  value,
  onChange,
  options,
  ...rest
}: {
  value: string;
  onChange: (value: string) => void;
  options: ReadonlyArray<{ value: string; label: string }>;
} & Omit<ComponentProps<"select">, "value" | "onChange">) {
  return (
    <select
      {...rest}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className={inputClass}
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
  "rounded-md px-4 py-2 text-sm font-medium transition-colors focus:outline-none " +
  "focus-visible:ring-2 focus-visible:ring-sky-500 disabled:cursor-not-allowed disabled:opacity-50";

export function PrimaryButton(props: ComponentProps<"button">) {
  return (
    <button
      {...props}
      className={`${buttonBase} bg-sky-600 text-white hover:bg-sky-500 ${props.className ?? ""}`}
    />
  );
}

export function SecondaryButton(props: ComponentProps<"button">) {
  return (
    <button
      {...props}
      className={`${buttonBase} border border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 ${props.className ?? ""}`}
    />
  );
}

export function DangerButton(props: ComponentProps<"button">) {
  return (
    <button
      {...props}
      className={`${buttonBase} border border-red-900 bg-red-950 text-red-200 hover:bg-red-900 ${props.className ?? ""}`}
    />
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-700 bg-slate-900/50 px-6 py-12 text-center">
      <p className="text-sm text-slate-400">{message}</p>
    </div>
  );
}

export function ErrorBanner({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <div role="alert" className="mb-4 flex items-start justify-between gap-4 rounded-md border border-red-900 bg-red-950/60 px-4 py-3">
      <p className="text-sm text-red-200">{message}</p>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Fehlermeldung schließen"
        className="shrink-0 rounded px-2 py-1 text-sm text-red-300 hover:bg-red-900"
      >
        ✕
      </button>
    </div>
  );
}

export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div role="dialog" aria-modal="true" aria-label={title} className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg border border-slate-700 bg-slate-900 p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-100">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Schließen"
            className="rounded px-2 py-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
          >
            ✕
          </button>
        </div>
        {children}
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
  return (
    <Modal title={title} onClose={onCancel}>
      <p className="mb-6 text-sm text-slate-300">{message}</p>
      <div className="flex justify-end gap-3">
        <SecondaryButton type="button" onClick={onCancel}>
          Abbrechen
        </SecondaryButton>
        <DangerButton type="button" onClick={onConfirm}>
          {confirmLabel}
        </DangerButton>
      </div>
    </Modal>
  );
}
