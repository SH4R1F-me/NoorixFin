/**
 * Login route — server component (DEC-009).
 *
 * Reads `?next=` here rather than with useSearchParams() in the client form:
 * a client-side useSearchParams() bails the whole tree out of prerendering and
 * fails the production build without a Suspense boundary.
 */
import LoginForm from './login-form';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return <LoginForm next={next} />;
}
