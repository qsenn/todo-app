import { errorMessage } from "@/lib/client";

export function FormError({ error }: { error: unknown }) {
  if (!error) return null;
  return (
    <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
      {errorMessage(error)}
    </p>
  );
}
