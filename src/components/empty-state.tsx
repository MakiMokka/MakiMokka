import type { ReactNode } from 'react';

/**
 * Clearly labeled empty state. Used whenever there is genuinely no data, so
 * the UI never implies that a connection or sync exists when it does not.
 */
export function EmptyState({
  icon,
  title,
  body,
  action,
  testId,
}: {
  icon: ReactNode;
  title: string;
  body: string;
  action?: ReactNode;
  testId?: string;
}) {
  return (
    <section
      role="status"
      data-testid={testId ?? 'empty-state'}
      className="mx-auto flex max-w-sm flex-col items-center px-6 py-10 text-center"
    >
      <div className="bg-accent-soft text-accent rounded-container mb-5 flex size-16 items-center justify-center [&>svg]:size-8">
        {icon}
      </div>
      <h2 className="text-headline text-fg font-semibold">{title}</h2>
      <p className="text-fg-muted text-callout mt-2">{body}</p>
      {action ? <div className="mt-6">{action}</div> : null}
    </section>
  );
}

export function ErrorState({ icon, message }: { icon: ReactNode; message: string }) {
  return (
    <section
      role="alert"
      data-testid="error-state"
      className="mx-auto flex max-w-sm flex-col items-center px-6 py-10 text-center"
    >
      <div className="text-danger mb-4 [&>svg]:size-10">{icon}</div>
      <p className="text-fg-muted text-callout">{message}</p>
    </section>
  );
}
