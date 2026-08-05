/**
 * Branded 404 — also the app's catch-all for unmatched URLs (Next 13.3+).
 *
 * No retry button: re-requesting a URL that does not exist cannot start
 * existing, and a button that reliably does nothing is worse than no button.
 */
import { ErrorState } from '../components/error-state';

export default function NotFound() {
  return <ErrorState kind="notFound" homeHref="/dashboard" />;
}
