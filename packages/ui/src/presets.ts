import type { AccountBridgeClassNames } from './types.js';

/** Minimal headless preset — CSS variables only, no utility classes */
export const headlessPreset: AccountBridgeClassNames = {
  root: 'ab-settings',
  intro: 'ab-settings__intro',
  introTitle: 'ab-settings__intro-title',
  introDescription: 'ab-settings__intro-description',
  defaultProviderRow: 'ab-settings__default-row',
  defaultProviderLabel: 'ab-settings__default-label',
  select: 'ab-settings__select',
  providerGrid: 'ab-settings__grid',
  card: 'ab-settings__card',
  cardHeader: 'ab-settings__card-header',
  cardTitle: 'ab-settings__card-title',
  cardStatus: 'ab-settings__card-status',
  cardStatusConnected: 'ab-settings__card-status--connected',
  cardStatusDisconnected: 'ab-settings__card-status--disconnected',
  cardActions: 'ab-settings__card-actions',
  cardActionsColumn: 'ab-settings__card-actions-column',
  button: 'ab-settings__button',
  buttonSecondary: 'ab-settings__button ab-settings__button--secondary',
  buttonOAuth: 'ab-settings__button ab-settings__button--oauth',
  input: 'ab-settings__input',
  link: 'ab-settings__link',
  error: 'ab-settings__error',
  muted: 'ab-settings__muted',
  keyForm: 'ab-settings__key-form',
  cardBrand: 'ab-settings__card-brand',
  cardIcon: 'ab-settings__card-icon',
  cardMeta: 'ab-settings__card-meta',
  statusBadge: 'ab-settings__status-badge',
  statusBadgeConnected: 'ab-settings__status-badge ab-settings__status-badge--connected',
  statusBadgeDisconnected: 'ab-settings__status-badge ab-settings__status-badge--disconnected',
  defaultProviderCard: 'ab-settings__default-card',
  loading: 'ab-settings__loading',
  loadingDots: 'ab-settings__loading-dots',
};

/**
 * shadcn/ui-compatible Tailwind classes — drop into R2Works, CentralR2, Lovable apps
 * that already use shadcn tokens (border-input, bg-card, text-muted-foreground, etc.)
 */
export const shadcnPreset: AccountBridgeClassNames = {
  root: 'space-y-4',
  intro: 'space-y-1',
  introTitle: 'text-lg font-semibold leading-none tracking-tight',
  introDescription: 'text-sm text-muted-foreground',
  defaultProviderRow: 'flex flex-col gap-2 sm:flex-row sm:items-center',
  defaultProviderLabel: 'text-sm font-medium leading-none',
  select:
    'flex h-9 w-full max-w-xs rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
  providerGrid: 'grid gap-4',
  card: 'rounded-lg border bg-card text-card-foreground shadow-sm p-4 space-y-3',
  cardHeader: 'flex items-center justify-between gap-2',
  cardTitle: 'font-medium leading-none',
  cardStatus: 'text-sm',
  cardStatusConnected: 'text-sm text-emerald-600 dark:text-emerald-400',
  cardStatusDisconnected: 'text-sm text-muted-foreground',
  cardActions: 'flex flex-wrap items-center gap-2',
  cardActionsColumn: 'flex flex-col gap-2',
  button:
    'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground shadow hover:bg-primary/90 h-9 px-4 py-2',
  buttonSecondary:
    'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground h-9 px-4 py-2',
  buttonOAuth:
    'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground h-9 px-4 py-2',
  input:
    'flex h-9 w-full min-w-[12rem] rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
  link: 'text-sm font-medium text-primary underline-offset-4 hover:underline',
  error: 'text-sm font-medium text-destructive',
  muted: 'text-sm text-muted-foreground',
  keyForm: 'flex flex-wrap items-center gap-2 pt-3 border-t border-border',
  cardBrand: 'flex items-center gap-3.5 min-w-0',
  cardIcon: 'flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] border border-input text-xs font-bold',
  cardMeta: 'flex flex-col gap-1.5 min-w-0',
  statusBadge: 'inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium',
  statusBadgeConnected: 'inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  statusBadgeDisconnected: 'inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium bg-muted text-muted-foreground',
  defaultProviderCard: 'rounded-lg border bg-muted/30 p-4 space-y-2',
  loading: 'flex flex-col items-center gap-3 py-8 text-sm text-muted-foreground',
  loadingDots: 'flex gap-1.5',
};

/** CSS custom properties for headless preset — import in host global CSS */
export { accountBridgeThemeCss, accountBridgeThemeCss as headlessCssVariables } from './theme.js';

export function mergeClassNames(
  base: AccountBridgeClassNames,
  overrides?: Partial<AccountBridgeClassNames>,
): AccountBridgeClassNames {
  return { ...base, ...overrides };
}

export {
  headlessCopilotPreset,
  shadcnCopilotPreset,
  mergeCopilotClassNames,
} from './copilotPresets.js';
export type { CopilotClassNames } from './copilotTypes.js';
