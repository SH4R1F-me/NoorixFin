/**
 * Forgot password — was a 404 linked from the login form.
 *
 * Server page + client form, matching the login route: a client
 * `useSearchParams()` would bail the tree out of prerendering.
 */
import ForgotPasswordForm from './forgot-password-form';

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />;
}
