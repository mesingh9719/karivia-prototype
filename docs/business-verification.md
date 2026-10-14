# Business verification flow

## Implemented review findings

The original form navigated to login after showing a success toast without creating a request or retaining a file. It had no account ownership, role-specific proof, document type selection, upload validation, review step, submission errors, saved status, resubmission, or document inspection for administrators.

The replacement is at `/verify-documents`, reached after professional registration and through salon/freelancer workspace navigation. Account type is derived from the signed-in profile rather than an editable URL parameter.

- Three steps: professional/contact details, required documents, and final review with explicit confirmation.
- Passport (photo page), national identity card (front/back), and driving licence (front/back).
- Salons additionally provide registration, trade/salon licence, or tax registration proof.
- Upload picker and drag/drop; image and PDF previews; removal/replacement; per-slot errors; 10 MB per-file maximum; empty files, MIME/extension mismatch, missing sides, and duplicate file selections rejected.
- Accessible input labels, inline errors, first-error focus, keyboard upload controls, focus indicators, mobile layouts, and reduced-motion handling.
- Explicit device-local drafts retain details and files in IndexedDB. Consent resets when restoring or modifying details. Submission clears the draft.
- Pending/approved status prevents new submission. Rejected requests show reviewer feedback and can be corrected and resubmitted.
- Files remain in IndexedDB in mock mode; metadata and request status use the existing mock resource store. Failed saves roll back newly written files.
- Dedicated admin queue supports status filters, detail inspection, previews, approval, and changes requested with a reason. Legacy seed records without uploads cannot be approved.
- Submission/review locks prevent repeated clicks; status is rechecked before writing a review.

## Production integration contract

This repository is a frontend demo; it contains no verification backend. Setting `VITE_DATA_PROVIDER=api` enables the following expected endpoints under `VITE_API_BASE_URL`. These endpoints must be implemented by the backend before production verification can work.

- `GET /verifications` with `filters[userId]` / `pageSize`: existing resource list shape `{data: [...], total, page, pageSize}`. The backend must restrict visibility to the owner or an administrator regardless of the supplied filter.
- `GET /verifications/:id`: returns a request object.
- `POST /verifications`: multipart form data with a JSON `details` field and file fields `front`, optional `back`, and salon-only `business`. The response is the saved request object, including its ID, server-owned status, submission timestamp and document metadata.
- `POST /verifications/:id/resubmit`: same multipart shape; atomically replaces an owner’s rejected request and clears its rejection feedback.
- `GET /verifications/:id/documents/:documentKey`: authenticated binary download, returning PDF, JPEG or PNG. Each document metadata entry includes `key` (or `id`), `slot`, `label`, `name`, `size`, and `mime`.
- `PATCH /verifications/:id`: admin review decision with `status` and `rejectionReason`. The server must atomically require current status pending and set reviewer identity/timestamps from the authenticated session.

The server must derive account ownership, role, status and timestamps itself, validate details and document requirements, inspect actual file signatures, scan files, enforce request size/rate limits, and reject duplicate active submissions atomically. Frontend MIME and duplicate selection checks are usability checks, not security guarantees. Document authenticity, expiration, representative authority and jurisdiction-specific eligibility require reviewer or verification-provider checks. Store private documents outside public assets and define retention/deletion policies. Mock authentication is not secure access control.

## Verification

Run `npm test`, `npm run lint`, and `npm run build`.

Manual browser acceptance checks:
1. Register a salon; complete details; choose a two-sided ID; verify front/back plus business proof are required.
2. Register a freelancer; choose passport; confirm no business proof or back-side upload is requested.
3. Try blank/invalid contact details, empty/oversized/wrong-type files, duplicated front/back, and multiple dropped files.
4. Save a draft, reload, confirm files restore and confirmation must be checked again.
5. Submit; reload; confirm pending status and no duplicate form.
6. Log into the admin demo on the same browser/device; preview files; request changes with feedback.
7. Log back into the professional account; read feedback; correct and resubmit; approve from admin.
8. Verify approved status, mobile layout, keyboard navigation, and unavailable-storage errors.

Browser automation is not available in this session. Unit tests verify validation rules; build and lint verify compilation and hook correctness. Backend integration remains unverified until the contract is implemented.
