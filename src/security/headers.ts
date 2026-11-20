import { BMA_LAYER_ORIGIN } from '../zone/layer-origin'

const MAP_TILE_ORIGIN = 'https://tiles.openfreemap.org'

const PERMISSIONS_POLICY = ['camera', 'microphone', 'geolocation', 'payment', 'usb'].map((feature) => `${feature}=()`).join(', ')

function contentSecurityPolicy(development: boolean): string {
  const directives = [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${development ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    `connect-src 'self' ${MAP_TILE_ORIGIN} ${BMA_LAYER_ORIGIN}`,
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ]
  return directives.join('; ')
}

export function securityHeaders(development: boolean) {
  return [
    { key: 'Content-Security-Policy', value: contentSecurityPolicy(development) },
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'X-Frame-Options', value: 'DENY' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    { key: 'Permissions-Policy', value: PERMISSIONS_POLICY },
  ]
}
