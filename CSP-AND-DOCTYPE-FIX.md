# Content Security Policy and DOCTYPE Fix

## Issues Fixed

1. **DOCTYPE Declaration Fix**
   - Fixed malformed DOCTYPE in `esports-and-events.html` that was causing Quirks Mode rendering
   - Proper declaration: `<!DOCTYPE html>` 

2. **Content Security Policy Fix**
   - Updated Content Security Policy to allow VS Code Live Preview WebSockets
   - Added wildcard port support for local development: `ws://127.0.0.1:*` and `ws://localhost:*`

## Files Updated

- `esports-and-events.html`
- `esports-and-events-themed.html` 
- `create-test-events.html`

## How to Fix Other Files

If you encounter similar errors in other HTML files:

1. Ensure the first line contains a proper DOCTYPE: `<!DOCTYPE html>`

2. Update the Content Security Policy to include WebSocket connections:
   ```html
   <meta http-equiv="Content-Security-Policy" content="default-src 'self'; 
   script-src 'self' 'unsafe-inline' https://www.gstatic.com https://unpkg.com https://firestore.googleapis.com; 
   style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://fonts.gstatic.com https://cdn.jsdelivr.net https://unpkg.com; 
   font-src 'self' https://fonts.gstatic.com https://cdn.jsdelivr.net https://unpkg.com; 
   img-src 'self' data: https: blob:; 
   connect-src 'self' https://firestore.googleapis.com https://firebase.googleapis.com 
   https://identitytoolkit.googleapis.com https://securetoken.googleapis.com 
   wss://*.firebaseio.com ws://127.0.0.1:* ws://localhost:*;">
   ```

3. If a file doesn't have a CSP yet, add it right after the viewport meta tag

## Error Messages Resolved

- "This page is in Quirks Mode. Page layout may be impacted. For Standards Mode use '<!DOCTYPE html>'."
- "Content-Security-Policy: The page's settings blocked the loading of a resource (connect-src) at ws://127.0.0.1:3001/..."
