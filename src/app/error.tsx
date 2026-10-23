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
      <h1 className="text-[20px] font-semibold">Something went wrong · Algo salió mal</h1>
      <p className="text-secondary-label mt-2 text-[15px]">
        An unexpected error occurred. · Ocurrió un error inesperado.
      </p>
      <button type="button" onClick={reset} className="text-tint mt-6 min-h-11 text-[17px]">
        Try again · Intentar de nuevo
      </button>
    </main>
  );
}
