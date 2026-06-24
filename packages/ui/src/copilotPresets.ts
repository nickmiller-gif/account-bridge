import type { CopilotClassNames } from './copilotTypes.js';

export const headlessCopilotPreset: CopilotClassNames = {
  root: 'ab-copilot',
  header: 'ab-copilot__header',
  title: 'ab-copilot__title',
  subtitle: 'ab-copilot__subtitle',
  messageList: 'ab-copilot__messages',
  messageUser: 'ab-copilot__message ab-copilot__message--user',
  messageAssistant: 'ab-copilot__message ab-copilot__message--assistant',
  messageRole: 'ab-copilot__message-role',
  messageContent: 'ab-copilot__message-content',
  composer: 'ab-copilot__composer',
  textarea: 'ab-copilot__textarea',
  toolbar: 'ab-copilot__toolbar',
  button: 'ab-copilot__button',
  buttonSecondary: 'ab-copilot__button ab-copilot__button--secondary',
  error: 'ab-copilot__error',
  empty: 'ab-copilot__empty',
  fab: 'ab-copilot__fab',
  panel: 'ab-copilot__panel',
  panelOpen: 'ab-copilot__panel ab-copilot__panel--open',
  panelHeader: 'ab-copilot__panel-header',
};

export const shadcnCopilotPreset: CopilotClassNames = {
  root: 'flex flex-col gap-3 rounded-lg border bg-card text-card-foreground shadow-sm',
  header: 'space-y-1 px-4 pt-4',
  title: 'text-lg font-semibold leading-none tracking-tight',
  subtitle: 'text-sm text-muted-foreground',
  messageList: 'flex max-h-96 flex-col gap-3 overflow-y-auto px-4 py-2',
  messageUser: 'ml-8 rounded-lg bg-primary px-3 py-2 text-primary-foreground',
  messageAssistant: 'mr-8 rounded-lg border bg-muted/50 px-3 py-2',
  messageRole: 'sr-only',
  messageContent: 'text-sm whitespace-pre-wrap',
  composer: 'flex flex-col gap-2 border-t p-4',
  textarea:
    'flex min-h-[4.5rem] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
  toolbar: 'flex flex-wrap items-center gap-2',
  button:
    'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground shadow hover:bg-primary/90 h-9 px-4 py-2',
  buttonSecondary:
    'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground h-9 px-4 py-2',
  error: 'px-4 text-sm font-medium text-destructive',
  empty: 'px-4 py-8 text-center text-sm text-muted-foreground',
  fab: 'fixed bottom-6 right-6 z-50 inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90',
  panel:
    'fixed bottom-24 right-6 z-50 flex w-[min(100vw-2rem,24rem)] flex-col overflow-hidden rounded-xl border bg-card shadow-2xl',
  panelOpen:
    'fixed bottom-24 right-6 z-50 flex w-[min(100vw-2rem,24rem)] flex-col overflow-hidden rounded-xl border bg-card shadow-2xl',
  panelHeader: 'flex items-center justify-between border-b px-4 py-3',
};

export function mergeCopilotClassNames(
  base: CopilotClassNames,
  overrides?: Partial<CopilotClassNames>,
): CopilotClassNames {
  return { ...base, ...overrides };
}
