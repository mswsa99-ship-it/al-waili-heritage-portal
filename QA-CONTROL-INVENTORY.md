# QA control inventory — 30 October 2026

## Evidence boundary

This is a source audit and local test result, not a claim that a human or browser clicked every control. Production data was not changed by this audit. Browser behavior, responsive layout, focus handling and 100 simultaneous browser sessions require separate runtime evidence. The root QA report records load-test coverage separately.

## Reachable control families

| Surface | Controls to exercise | Supporting implementation / target |
|---|---|---|
| Public shell | Main links, mobile menu, member access, contact | `components/public-shell.tsx`, `components/portal-link.tsx` |
| Public information | News links, heritage search and filters, content tabs | Public app pages; `components/content-tabs.tsx` |
| Public contact | Subject/topic/body submission, authentication response, validation | `components/contact-form.tsx` |
| Member/admin navigation | Member group links, administrative group links, per-group tabs, back navigation | `app/portal/portal-client.tsx`, `lib/portal-navigation.ts` |
| Family lineage viewer | Search by name/id/branch, person selection, ancestors, children | `app/portal/lineage-panel.tsx`, `/api/genealogy` |
| Working lineage | Search, select person, add/edit/archive proposal, parent/gender/date/contact fields, optional private photo, source, grant, refresh | `app/lineage-workspace/lineage-client.tsx`, `/api/lineage-workspace` |
| Lineage reviews | Request details, private review photo, approve/return/reject, review reasons, returned-request continuation | Same; `/api/lineage-photo` |
| Delegation | Select person/root, expiry, create, activate linked member, revoke | Same |
| Lineage tasks | Assign title/person/root/due date, submit report, approve/return | Same |
| Branch report/import | Branch progress metrics; import difference check and guarded application | Same; manager-only import |
| Approved registry | Decision selection, create/update/archive, person/parent/relation/privacy fields, publish decision, decision-load retry | `app/portal/registry-panel.tsx`, `/api/genealogy`, `/api/portal` |
| Archive/contributions | Contribution inputs, review actions and document access | `app/portal/archive-panel.tsx` |
| Profile/expertise | Own profile fields, opt-in settings, expertise search | `app/portal/profile-panel.tsx` |
| News | Create, edit/cancel, audience/category, publish with confirmation | `app/portal/portal-client.tsx` |
| Events | Calendar, event creation, attend/decline | Same; `app/portal/event-calendar.tsx` |
| Service requests | Type/subject/body, reasoned closure, independent procedural review | `app/portal/portal-client.tsx` |
| Communication/voting | Communication forms and voting actions | `app/portal/family-communication-panel.tsx` |
| Personal tasks | Task creation and status/report actions | `app/portal/member-tasks-panel.tsx` |
| Branch/committee | Branch review controls; documented vote/recusal and independent review | `app/portal/portal-client.tsx` |
| Membership/invitations | Nomination, invitation preparation/issue/revoke, tree-person selection | `app/portal/invite-actions.tsx`, `invitation-panel.tsx`, `enrollment-panel.tsx` |
| Council/office | Council and committee assignments | `app/portal/council-panel.tsx` |
| Inbox | List, status update, resolution with explanation | `app/portal/inquiries-panel.tsx` |
| Governance | Role/privacy/governance controls | `app/portal/governance-panel.tsx` |
| Community | Program create/publish/unpublish/join/leave; roster; meeting create/approve | `app/portal/community-programs.tsx` |
| Private attachments | Type/size validation, upload, list, authorized download | `components/private-files.tsx`, `/api/private-attachments` |

This inventory groups repeated controls, and does not assert an exact rendered-button count. Availability depends on role and current record state. `tree-workspace-panel.tsx` is a legacy component; the currently embedded working-lineage surface is `LineageClient`, so legacy controls were not counted as live failures.

## Findings corrected in this audit

### P1 — returned lineage requests had no usable continuation

Reproduction from code: reviewer selects `needs_information`; request leaves pending state. The request card formerly omitted `decision_note` and `reviewed_at`; only pending cards had actions. The author could not see what needed correction or continue from submitted values.

Correction: show decision reason/date; offer the author a prefilled new proposal for returned requests. The original decision remains immutable. Source note references the original request ID. The user is explicitly told to reattach an optional photo; the private photo is not copied or exposed through JSON. Existing server authorization and relation validation still apply. Reviewer actions are hidden on the reviewer's own requests.

### P1 — task buttons advertised invalid transitions

Reproduction from code: every task, including approved/submitted tasks, displayed “submit report”; managers saw approval/return even on assigned tasks. Server `taskTransition` correctly rejected these operations, appearing to users as non-working buttons.

Correction: use the same `taskTransition` policy in the client. Submit only on assigned/in-progress/returned; review only on submitted. Self-approval is disabled with an explanatory title using server-returned `updated_by` and actor user ID. Archived people are removed from assignment/delegation selectors.

### P2 — registry decision fetch silently swallowed HTTP errors

Reproduction from code: `/api/portal` returns a 403/500 JSON error; old fetch omitted `response.ok`, treating the response as an empty decision list. No useful retry was available.

Correction: check status, expose the error, offer retry, disable decision submission while the decision source is in error. This does not turn a failed fetch into a false empty success.

## Additional consolidated repairs and remaining verification

- Resolved by root: Event RSVP requests now use a pending ref/state guard against rapidly repeated attendance/decline requests (`EventEntry`, `portal-client.tsx`).
- Resolved by root: private attachment input resets after an attempted upload so choosing the same file after failure retriggers `change` (`components/private-files.tsx`).
- Resolved: community, lineage viewer and inquiries now provide a dedicated retry for failed reads, display loading state and preserve previously loaded data. Lineage/inquiries no longer misrepresent a failed initial load as an empty result. Mutation errors are kept separate from read errors in community/inquiries.
- Full keyboard traversal, narrow-screen overflow, modal/prompt usability, and actual navigation in the hosted preview remain browser-unverified by this audit.

## Executed validation

| Check | Result |
|---|---|
| TypeScript `npx tsc --noEmit` | Passed |
| `node tests/lineage-integration.mjs` | 54 passed; fixture has 216 active / 16 pending; zero production writes |
| `node tests/portal-navigation.test.mjs` | 62 destination checks passed |
| `node tests/route-links.test.mjs` | 32 internal links checked; passed |

The integration suite intentionally logs rejected ancestry-cycle/archive attempts; these are successful negative tests, not failures. These checks validate policies/routes and compatibility; they are not substitutes for browser clicks or mobile visual inspection.
