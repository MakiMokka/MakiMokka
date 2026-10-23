'use client';

/**
 * Error boundary. Client components cannot load the server dictionary, so
 * this screen is bilingual. Error details are never shown.
 */
export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="pt-safe flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <h1 className="text-headline text-fg font-semibold">Something went wrong · Algo salió mal</h1>
      <p className="text-fg-muted text-callout mt-2">
        An unexpected error occurred. · Ocurrió un error inesperado.
      </p>
      <button
        type="button"
        onClick={reset}
        className="text-accent text-body mt-6 min-h-11 font-medium"
      >
        Try again · Intentar de nuevo
      </button>
    </main>
  );
}
