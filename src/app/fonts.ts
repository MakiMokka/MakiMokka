import localFont from 'next/font/local';

/**
 * Plus Jakarta Sans (SIL Open Font License 1.1, see ./fonts/PlusJakartaSans-OFL.txt),
 * variable weight, Latin subset (covers English and Spanish). Self-hosted so
 * the CSP can stay at font-src 'self'. Used for display/UI titles only;
 * reading text uses the system font for Dynamic Type and legibility.
 */
export const jakarta = localFont({
  src: './fonts/PlusJakartaSans-latin-wght.woff2',
  weight: '200 800',
  style: 'normal',
  display: 'swap',
  variable: '--font-jakarta',
  fallback: ['-apple-system', 'BlinkMacSystemFont', 'system-ui', 'sans-serif'],
});
