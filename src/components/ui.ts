// Shared Tailwind class strings, following docs/DESIGN.md (tokens live in src/app/globals.css).

// text-input: white, 1px hairline, 8px radius; focus thickens to a 2px ink border (no glow).
export const inputClass =
  "h-12 w-full rounded-sm border border-hairline bg-canvas px-3 text-base text-ink placeholder:text-muted focus:border-2 focus:border-ink focus:px-[11px] focus:outline-none";
export const labelClass = "mb-1.5 block text-sm font-medium text-muted";

// button-primary / -active / -disabled: Rausch fill, white 16px/500 label, 8px radius, 48px tall.
export const primaryButton =
  "inline-flex h-12 items-center justify-center rounded-sm bg-primary px-6 text-base font-medium text-white active:bg-primary-active disabled:cursor-not-allowed disabled:bg-primary-disabled";
// button-secondary: white fill, ink label, 1px ink outline.
export const secondaryButton =
  "inline-flex h-12 items-center justify-center rounded-sm border border-ink bg-canvas px-6 text-base font-medium text-ink hover:bg-surface-soft disabled:cursor-not-allowed disabled:border-border-strong disabled:text-muted-soft";
// Destructive actions use the error red rather than the brand accent.
export const dangerButton =
  "inline-flex h-12 items-center justify-center rounded-sm bg-error px-6 text-base font-medium text-white hover:bg-error-hover disabled:cursor-not-allowed disabled:opacity-50";
// button-tertiary-text: plain ink label, underlined on hover.
export const linkButton = "text-sm font-medium text-ink underline-offset-4 hover:underline";
// icon-button-outline: 40px white circle with a hairline border.
export const iconButton =
  "inline-flex h-10 w-10 items-center justify-center rounded-full border border-hairline bg-canvas text-lg text-ink hover:border-ink";

