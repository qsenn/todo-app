import { errorMessage } from "@/lib/client";

export function FormError({ error }: { error: unknown }) {
  if (!error) return null;
  return (
    <p role="alert" className="rounded-sm border border-error/30 bg-surface-soft px-3 py-2 text-sm text-error">
      {errorMessage(error)}
    </p>
  );
}
