"use client";

import { useId, useState, type FormEvent } from "react";
import type { GoalCreate } from "@/lib/schemas";
import type { GoalDTO } from "@/lib/types";
import { FormError } from "./FormError";
import { inputClass, labelClass, primaryButton, secondaryButton } from "./ui";

type Props = {
  initial?: GoalDTO;
  defaultYear: number;
  submitLabel: string;
  pending: boolean;
  error: unknown;
  onSubmit: (values: GoalCreate) => void;
  onCancel?: () => void;
};

export function GoalForm({ initial, defaultYear, submitLabel, pending, error, onSubmit, onCancel }: Props) {
  const id = useId();
  const [year, setYear] = useState(String(initial?.year ?? defaultYear));
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");

  function submit(event: FormEvent) {
    event.preventDefault();
    onSubmit({ year: Number(year), title, description });
  }

  return (
    <form onSubmit={submit} className="space-y-3" aria-label={submitLabel}>
      <div className="grid gap-3 sm:grid-cols-[8rem_1fr]">
        <div>
          <label className={labelClass} htmlFor={`${id}-year`}>연도</label>
          <input id={`${id}-year`} type="number" min={1970} max={9999} className={inputClass} value={year} onChange={(e) => setYear(e.target.value)} required />
        </div>
        <div>
          <label className={labelClass} htmlFor={`${id}-title`}>제목</label>
          <input id={`${id}-title`} className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={200} />
        </div>
      </div>
      <div>
        <label className={labelClass} htmlFor={`${id}-description`}>설명 (선택)</label>
        <textarea id={`${id}-description`} rows={2} className={inputClass} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={2000} />
      </div>
      <FormError error={error} />
      <div className="flex justify-end gap-2">
        {onCancel && <button type="button" className={secondaryButton} onClick={onCancel}>취소</button>}
        <button type="submit" className={primaryButton} disabled={pending}>{submitLabel}</button>
      </div>
    </form>
  );
}
