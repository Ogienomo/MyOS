import { NextRequest } from 'next/server'

/**
 * Extracts the userId from a NextRequest.
 * Checks the "myos-user-id" cookie first, then the "myos-user-id" header.
 * Falls back to "default" for backward compatibility.
 */
export function getUserId(request: NextRequest): string {
  const cookieValue = request.cookies.get('myos-user-id')?.value
  if (cookieValue && cookieValue.trim()) return cookieValue.trim()

  const headerValue = request.headers.get('myos-user-id')
  if (headerValue && headerValue.trim()) return headerValue.trim()

  return 'default'
}
