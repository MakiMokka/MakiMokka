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
      className="mx-auto flex max-w-sm flex-col items-center px-6 py-16 text-center"
    >
      <div className="text-tertiary-label mb-4 [&>svg]:size-14">{icon}</div>
      <h2 className="text-[20px] font-semibold">{title}</h2>
      <p className="text-secondary-label mt-2 text-[15px] leading-relaxed">{body}</p>
      {action ? <div className="mt-6">{action}</div> : null}
    </section>
  );
}

export function ErrorState({ icon, message }: { icon: ReactNode; message: string }) {
  return (
    <section
      role="alert"
      data-testid="error-state"
      className="mx-auto flex max-w-sm flex-col items-center px-6 py-16 text-center"
    >
      <div className="text-destructive mb-4 [&>svg]:size-12">{icon}</div>
      <p className="text-secondary-label text-[15px]">{message}</p>
    </section>
  );
}
