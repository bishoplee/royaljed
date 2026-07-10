# Phase 5 Execution Plan — Secure Link Engine

## Objective
Enable administrators to create expiring, one-time lesson access links and let authorized guests open lesson content without a full user session.

## Success Criteria
- Admins can create a secure link for any lesson from the curriculum admin UI.
- Links expire automatically and stop working after the configured view limit.
- Guests can open a lesson through a tokenized URL and stream the protected HLS content.
- Access attempts are blocked when the token is invalid, expired, or exhausted.

---

## Workstream 1 — Backend API & Link Lifecycle

### 1.1 Create access-link management API
- Add a POST route to create a new access link for a lesson.
- Accept inputs:
  - lessonId
  - expiresAt
  - maxViews
  - optional studentId
- Generate a secure random token.
- Persist the link through Prisma using the existing access_links table.

### 1.2 List and revoke links
- Add a GET route to list active and expired links for a lesson.
- Add a DELETE route to revoke a link manually.
- Ensure revoked/expired links are no longer accepted by the stream route.

### 1.3 Harden token validation in the stream endpoint
- Reuse and finalize the existing token validation logic in the HLS stream route.
- Enforce:
  - matching lessonId
  - non-expired token
  - remaining view count
  - school/tenant ownership
- Increment viewCount only when the playlist index request is served.

### 1.4 Audit logging
- Record when a link is created, used, or revoked.
- Keep logs scoped to the school context.

---

## Workstream 2 — Admin UI

### 2.1 Add a “Secure Links” panel to lesson administration
- Place the UI near the lesson detail/editor area in the curriculum admin experience.
- Show:
  - existing links
  - expiration date
  - max views
  - current usage count
  - revoke action

### 2.2 Create a link generation form
- Add a simple form with:
  - expiry date/time selector
  - max views input
  - optional student selection
- On submit, call the create-link API and refresh the list.

### 2.3 Copy link UX
- Provide a copy-to-clipboard action for the generated URL.
- Include the token as a query parameter in the final guest URL.

---

## Workstream 3 — Guest Playback Experience

### 3.1 Create a guest lesson view route
- Add a public-facing route that accepts the lessonId and token.
- Load lesson metadata and show a minimal player shell.

### 3.2 Embed protected video playback
- Pass the token into the HLS stream request.
- Render the player with the secure stream URL.
- Ensure the route blocks unauthorized access with a clear message.

### 3.3 Friendly error handling
- If the link is expired or depleted, display a message such as:
  - “This access link has expired.”
  - “This access link has already been used.”

---

## Workstream 4 — Security & Quality

### 4.1 Validate input boundaries
- Ensure expiry dates are valid and not in the past.
- Enforce sensible maxViews values.
- Verify the school slug matches the lesson’s owner.

### 4.2 Prevent abuse
- Avoid token reuse.
- Reject invalid or tampered tokens.
- Prevent unauthenticated access to private stream assets.

### 4.3 Verification
- Run the app build.
- Manually test:
  1. create a link
  2. open it in a guest session
  3. verify the stream loads
  4. verify expiry and view-count enforcement

---

## Recommended Execution Order
1. Backend API routes for create/list/revoke.
2. Stream-route token enforcement and view-count logic.
3. Admin UI panel and link generation form.
4. Guest playback route and player integration.
5. Audit logging, polish, and verification.

---

## Files Likely to Change
- src/app/api/ec/[schoolSlug]/admin/lessons/[lessonId]/access-links/route.ts
- src/app/api/ec/[schoolSlug]/lessons/[lessonId]/stream/[...file]/route.ts
- src/app/ec/[schoolSlug]/admin/curriculum/CurriculumClient.tsx
- src/app/ec/[schoolSlug]/lessons/[lessonId]/guest/page.tsx
- src/lib/auth.ts (only if shared guest handling is needed)
- prisma/schema.prisma (only if schema extensions are required)
