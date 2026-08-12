import path from "node:path";
import type { NextConfig } from "next";

/**
 * Security headers (audit gap S1).
 *
 * These are the *static* headers — the ones whose value does not depend on the
 * request. The `Content-Security-Policy` deliberately does NOT live here: it
 * carries a per-request nonce and is set in `src/proxy.ts`. Setting it in both
 * places would emit the header twice, and a browser given two CSP headers
 * enforces the INTERSECTION of both — which is how a policy that each author
 * believes is correct ends up blocking the application.
 *
 * `X-Frame-Options` is kept even though the CSP's `frame-ancestors 'none'`
 * supersedes it, because it is the only clickjacking control older browsers
 * understand and it costs one line.
 */
const isProd = process.env.NODE_ENV === 'production';

const securityHeaders = [
  // Never sniff a response into a different Content-Type than it declares.
  { key: 'X-Content-Type-Options', value: 'nosniff' },

  // Clickjacking. Superseded by frame-ancestors for modern browsers.
  { key: 'X-Frame-Options', value: 'DENY' },

  // Send the full URL to ourselves, only the origin cross-site, and nothing at
  // all when downgrading to http. A dashboard path can name a resource.
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },

  // Powerful features this app does not use. Listing them empty means a future
  // dependency cannot quietly start asking for the user's location or camera.
  {
    key: 'Permissions-Policy',
    value: [
      'accelerometer=()',
      'autoplay=()',
      'camera=()',
      'display-capture=()',
      'encrypted-media=()',
      'geolocation=()',
      'gyroscope=()',
      'magnetometer=()',
      'microphone=()',
      'midi=()',
      'payment=()',
      'usb=()',
      'xr-spatial-tracking=()',
      'browsing-topics=()',
    ].join(', '),
  },

  // Isolate this browsing context from anything that opens it, so a malicious
  // opener cannot reach into the window holding a signed-in session.
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },

  // Production only. On http a browser ignores HSTS anyway, but a developer
  // running a local https listener with a self-signed certificate would get
  // the origin pinned for a year, and there is no way to un-pin it quickly.
  //
  // `preload` is deliberately NOT set. Preloading is effectively irreversible
  // and binds every present and future subdomain — that is the owner's call to
  // make and submit, not a default to inherit from a config file.
  ...(isProd
    ? [
        {
          key: 'Strict-Transport-Security',
          value: 'max-age=31536000; includeSubDomains',
        },
      ]
    : []),
];

const nextConfig: NextConfig = {
  // Lets CI and local verification build beside a running dev server instead
  // of fighting it for `.next/lock`.
  distDir: process.env.NEXT_DIST_DIR ?? '.next',
  turbopack: {
    // Absolute, because the workspace root is two levels up and a relative
    // value made `next build` warn on every run.
    root: path.join(import.meta.dirname, '..', '..'),
  },

  // Do not advertise the framework and its version to anyone scanning.
  poweredByHeader: false,

  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default nextConfig;
