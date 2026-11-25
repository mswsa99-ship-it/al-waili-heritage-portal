import { integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const members = sqliteTable("members", {
  id: text("id").primaryKey(), userId: text("user_id").unique(),
  name: text("name").notNull(), email: text("email"), phone: text("phone"),
  branch: text("branch").notNull().default(""), personRef: text("person_ref").unique(),
  role: text("role").notNull().default("member"),
  status: text("status").notNull().default("pending"),
  minor: integer("minor", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull(),
});

export const announcements = sqliteTable("announcements", {
  id: text("id").primaryKey(), title: text("title").notNull(), body: text("body").notNull(),
  audience: text("audience").notNull().default("family"),
  category: text("category").notNull().default("news"),
  published: integer("published", { mode: "boolean" }).notNull().default(false),
  authorId: text("author_id").notNull(), createdAt: text("created_at").notNull(),
});

export const events = sqliteTable("events", {
  id: text("id").primaryKey(), title: text("title").notNull(),
  description: text("description").notNull().default(""),
  eventDate: text("event_date").notNull(), place: text("place").notNull().default(""),
  authorId: text("author_id").notNull(), createdAt: text("created_at").notNull(),
});

export const rsvps = sqliteTable("event_rsvps", {
  eventId: text("event_id").notNull(), userId: text("user_id").notNull(),
  response: text("response").notNull(), updatedAt: text("updated_at").notNull(),
}, (t) => [primaryKey({ columns: [t.eventId, t.userId] })]);

export const requests = sqliteTable("service_requests", {
  id: text("id").primaryKey(), userId: text("user_id").notNull(),
  kind: text("kind").notNull(), subject: text("subject").notNull(), body: text("body").notNull(),
  branch: text("branch").notNull().default(""),
  status: text("status").notNull().default("new"),
  resolution: text("resolution").notNull().default(""),
  parentRequestId: text("parent_request_id"),
  createdAt: text("created_at").notNull(), updatedAt: text("updated_at").notNull(),
});

export const proceduralReviews = sqliteTable("procedural_reviews", {
  requestId: text("request_id").notNull(), reviewerId: text("reviewer_id").notNull(),
  reviewerRole: text("reviewer_role").notNull(),
  note: text("note").notNull(), createdAt: text("created_at").notNull(),
}, (t) => [primaryKey({ columns: [t.requestId, t.reviewerRole] })]);

export const nominations = sqliteTable("nominations", {
  id: text("id").primaryKey(), proposerId: text("proposer_id").notNull(),
  personName: text("person_name").notNull(), personRef: text("person_ref").notNull(),
  branch: text("branch").notNull(), phone: text("phone").notNull(), email: text("email"),
  status: text("status").notNull().default("nominated"),
  createdAt: text("created_at").notNull(),
});

export const corrections = sqliteTable("genealogy_corrections", {
  id: text("id").primaryKey(), proposerId: text("proposer_id").notNull(),
  branch: text("branch").notNull(), personRef: text("person_ref").notNull(),
  proposedChange: text("proposed_change").notNull(), evidence: text("evidence").notNull(),
  level: text("level").notNull().default("ordinary"),
  branchReview: text("branch_review").notNull().default(""),
  independentReviewBy: text("independent_review_by"),
  independentReviewNote: text("independent_review_note").notNull().default(""),
  status: text("status").notNull().default("committee_review"),
  decisionNote: text("decision_note").notNull().default(""),
  createdAt: text("created_at").notNull(),
});

export const votes = sqliteTable("genealogy_votes", {
  correctionId: text("correction_id").notNull(), memberUserId: text("member_user_id").notNull(),
  vote: text("vote").notNull(), reason: text("reason").notNull().default(""),
  createdAt: text("created_at").notNull(),
}, (t) => [primaryKey({ columns: [t.correctionId, t.memberUserId] })]);

export const auditLog = sqliteTable("audit_log", {
  id: text("id").primaryKey(), actorId: text("actor_id").notNull(),
  action: text("action").notNull(), subjectId: text("subject_id").notNull(),
  createdAt: text("created_at").notNull(),
});

export const treeDraft = sqliteTable("tree_draft", {
  id: text("id").primaryKey(),
  recordsJson: text("records_json").notNull(),
  positionsJson: text("positions_json").notNull(),
  revision: integer("revision").notNull().default(0),
  editorId: text("editor_id").notNull(),
  updatedAt: text("updated_at").notNull(),
});

// Personal profiles are not genealogical evidence, and a genealogy record is
// not an application account. Keep the three concerns independent.
export const memberProfiles = sqliteTable("member_profiles", {
  userId: text("user_id").primaryKey(),
  displayName: text("display_name").notNull(),
  city: text("city").notNull().default(""),
  biography: text("biography").notNull().default(""),
  skills: text("skills").notNull().default(""),
  volunteering: text("volunteering").notNull().default(""),
  showCity: integer("show_city", { mode: "boolean" }).notNull().default(false),
  showSkills: integer("show_skills", { mode: "boolean" }).notNull().default(false),
  showBiography: integer("show_biography", { mode: "boolean" }).notNull().default(false),
  showVolunteering: integer("show_volunteering", { mode: "boolean" }).notNull().default(false),
  updatedAt: text("updated_at").notNull(),
});

// A tree-add invitation lets a person added from the tree (pending committee
// approval) activate an account and complete their own data. The token is
// handed over privately by the branch delegate; nothing is sent automatically.
export const memberDataInvites = sqliteTable("member_data_invites", {
  id: text("id").primaryKey(),
  personId: text("person_id").notNull(),
  tokenHash: text("token_hash").notNull().unique(),
  email: text("email").notNull().default(""),
  status: text("status").notNull().default("issued"),
  createdBy: text("created_by").notNull(),
  createdAt: text("created_at").notNull(),
  redeemedAt: text("redeemed_at"),
  completedAt: text("completed_at"),
  expiresAt: text("expires_at").notNull(),
});

export const genealogyRecords = sqliteTable("genealogy_records", {
  personId: text("person_id").primaryKey(),
  name: text("name").notNull(),
  gender: text("gender").notNull(),
  parentPersonId: text("parent_person_id"),
  parentRelation: text("parent_relation"),
  branch: text("branch").notNull().default(""),
  living: integer("living", { mode: "boolean" }).notNull().default(false),
  minor: integer("minor", { mode: "boolean" }).notNull().default(false),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  decisionId: text("decision_id").notNull(),
  approvedAt: text("approved_at").notNull(),
});

export const pendingInvitations = sqliteTable("pending_invitations", {
  id: text("id").primaryKey(),
  nominationId: text("nomination_id").notNull().unique(),
  memberId: text("member_id").notNull(),
  channel: text("channel").notNull(),
  status: text("status").notNull().default("awaiting_provider"),
  preparedBy: text("prepared_by").notNull(),
  preparedAt: text("prepared_at").notNull(),
  sentAt: text("sent_at"),
  acceptedAt: text("accepted_at"),
});

// Contributions remain private until an authorized editor explicitly reviews
// and releases them. No genealogical assertion is approved by publishing an item.
export const heritageItems = sqliteTable("heritage_items", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  kind: text("kind").notNull(),
  summary: text("summary").notNull(),
  source: text("source").notNull(),
  sourceAuthor: text("source_author").notNull().default(""),
  sourceDate: text("source_date").notNull().default(""),
  sourcePage: text("source_page").notNull().default(""),
  evidenceStatus: text("evidence_status").notNull().default("pending"),
  attachmentId: text("attachment_id"),
  period: text("period").notNull().default(""),
  contributorId: text("contributor_id").notNull(),
  visibility: text("visibility").notNull().default("pending"),
  reviewNote: text("review_note").notNull().default(""),
  reviewedBy: text("reviewed_by"),
  reviewedAt: text("reviewed_at"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const publicInquiries = sqliteTable("public_inquiries", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull().default(""),
  contactEmail: text("contact_email").notNull().default(""),
  topic: text("topic").notNull(),
  message: text("message").notNull(),
  status: text("status").notNull().default("new"),
  responseNote: text("response_note").notNull().default(""),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const councilTasks = sqliteTable("council_tasks", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  committee: text("committee").notNull().default("general"),
  assignedBranch: text("assigned_branch").notNull().default(""),
  dueDate: text("due_date").notNull().default(""),
  status: text("status").notNull().default("planned"),
  decisionNote: text("decision_note").notNull().default(""),
  createdBy: text("created_by").notNull(),
  updatedBy: text("updated_by").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

// Administrative preparation does not activate an account or dispatch a message.
// Every prepared membership references a separately approved genealogy record.
export const directEnrollments = sqliteTable("direct_enrollments", {
  id: text("id").primaryKey(),
  memberId: text("member_id").notNull().unique(),
  personId: text("person_id").notNull().unique(),
  channel: text("channel").notNull(),
  note: text("note").notNull().default(""),
  status: text("status").notNull().default("awaiting_provider"),
  preparedBy: text("prepared_by").notNull(),
  preparedAt: text("prepared_at").notNull(),
});

export const memberTasks = sqliteTable("member_tasks", {
  id: text("id").primaryKey(),
  personId: text("person_id").notNull(),
  kind: text("kind").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  dueDate: text("due_date").notNull().default(""),
  status: text("status").notNull().default("assigned"),
  memberReport: text("member_report").notNull().default(""),
  reviewNote: text("review_note").notNull().default(""),
  assignedBy: text("assigned_by").notNull(),
  updatedBy: text("updated_by").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

// Polls here are family consultations, never genealogy committee decisions.
export const familyPolls = sqliteTable("family_polls", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  optionsJson: text("options_json").notNull(),
  status: text("status").notNull().default("draft"),
  closesAt: text("closes_at").notNull(),
  createdBy: text("created_by").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const familyPollVotes = sqliteTable("family_poll_votes", {
  pollId: text("poll_id").notNull(),
  userId: text("user_id").notNull(),
  optionIndex: integer("option_index").notNull(),
  createdAt: text("created_at").notNull(),
}, (t) => [primaryKey({ columns: [t.pollId, t.userId] })]);

export const familyContributions = sqliteTable("family_contributions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  personId: text("person_id").notNull(),
  branch: text("branch").notNull().default(""),
  kind: text("kind").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  status: text("status").notNull().default("new"),
  responseNote: text("response_note").notNull().default(""),
  reviewedBy: text("reviewed_by"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

// The reviewed historical diagram becomes an editable working register only
// after an explicit owner import. This is separate from genealogy_records,
// whose committee decisions remain the source of formally approved lineage.
export const workingTreePeople = sqliteTable("working_tree_people", {
  id: text("id").primaryKey(),
  parentId: text("parent_id"),
  name: text("name").notNull(),
  gender: text("gender").notNull().default("male"),
  birthYear: text("birth_year").notNull().default(""),
  deathYear: text("death_year").notNull().default(""),
  education: text("education").notNull().default(""),
  city: text("city").notNull().default(""),
  profession: text("profession").notNull().default(""),
  phone: text("phone").notNull().default(""),
  email: text("email").notNull().default(""),
  position: text("position").notNull().default(""),
  sourceNote: text("source_note").notNull().default(""),
  readingStatus: text("reading_status").notNull().default(""),
  reviewStatus: text("review_status").notNull().default("pending"),
  sourceVersion: text("source_version").notNull().default(""),
  originalZone: text("original_zone").notNull().default(""),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  revision: integer("revision").notNull().default(1),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

// The delegate must be an existing tree person. Their scope is a single
// descendant subtree; identity activation follows the separate invite flow.
export const treeDelegateGrants = sqliteTable("tree_delegate_grants", {
  id: text("id").primaryKey(),
  delegatePersonId: text("delegate_person_id").notNull(),
  // Bound only to an already activated, genealogy-verified family account.
  // A tree-person nomination alone never enables a login.
  delegateUserId: text("delegate_user_id"),
  scopePersonId: text("scope_person_id").notNull(),
  status: text("status").notNull().default("assigned"),
  note: text("note").notNull().default(""),
  createdBy: text("created_by").notNull(),
  createdAt: text("created_at").notNull(),
  revokedBy: text("revoked_by"),
  revokedAt: text("revoked_at"),
});

// Every delegated create/update/delete is a proposal until independently
// reviewed. Pending payloads never mutate the active working tree.
export const treeChangeRequests = sqliteTable("tree_change_requests", {
  id: text("id").primaryKey(),
  action: text("action").notNull(),
  targetPersonId: text("target_person_id"),
  parentId: text("parent_id"),
  fieldsJson: text("fields_json").notNull().default("{}"),
  baseRevision: integer("base_revision"),
  delegateGrantId: text("delegate_grant_id"),
  authorId: text("author_id").notNull(),
  sourceNote: text("source_note").notNull().default(""),
  status: text("status").notNull().default("pending"),
  reviewedBy: text("reviewed_by"),
  reviewNote: text("review_note").notNull().default(""),
  reviewedAt: text("reviewed_at"),
  appliedPersonId: text("applied_person_id"),
  createdAt: text("created_at").notNull(),
});

export const lineageWorkDelegations = sqliteTable("lineage_work_delegations", {
  id: text("id").primaryKey(),
  delegate_person_id: text("delegate_person_id").notNull().references(() => workingTreePeople.id),
  root_person_id: text("root_person_id").notNull().references(() => workingTreePeople.id),
  permissions_json: text("permissions_json").notNull().default("[\"add\",\"edit\",\"archive\"]"),
  status: text("status").notNull().default("pending_activation"),
  issued_by: text("issued_by").notNull(),
  issued_at: text("issued_at").notNull(),
  expires_at: text("expires_at"),
  note: text("note").notNull().default(""),
});

export const lineageWorkRequests = sqliteTable("lineage_work_requests", {
  id: text("id").primaryKey(),
  operation: text("operation").notNull(),
  person_id: text("person_id").notNull(),
  parent_id: text("parent_id"),
  proposal_json: text("proposal_json").notNull(),
  expected_revision: integer("expected_revision"),
  grant_id: text("grant_id").references(() => lineageWorkDelegations.id),
  author_id: text("author_id").notNull(),
  status: text("status").notNull().default("pending"),
  reviewer_id: text("reviewer_id"),
  decision_note: text("decision_note").notNull().default(""),
  created_at: text("created_at").notNull(),
  reviewed_at: text("reviewed_at"),
});

export const lineageWorkTasks = sqliteTable("lineage_work_tasks", {
  id: text("id").primaryKey(),
  delegate_person_id: text("delegate_person_id").notNull().references(() => workingTreePeople.id),
  root_person_id: text("root_person_id").notNull().references(() => workingTreePeople.id),
  title: text("title").notNull(),
  kind: text("kind").notNull().default("complete_branch"),
  due_at: text("due_at"),
  status: text("status").notNull().default("assigned"),
  report: text("report").notNull().default(""),
  created_by: text("created_by").notNull(),
  updated_by: text("updated_by").notNull(),
  created_at: text("created_at").notNull(),
  updated_at: text("updated_at").notNull(),
});

export const lineageWorkPhotos = sqliteTable("lineage_work_photos", {
  person_id: text("person_id").primaryKey().references(() => workingTreePeople.id),
  mime_type: text("mime_type").notNull(),
  base64_data: text("base64_data").notNull(),
  updated_at: text("updated_at").notNull(),
  updated_by: text("updated_by").notNull(),
});

export const lineageWorkAudit = sqliteTable("lineage_work_audit", {
  id: text("id").primaryKey(),
  actor_id: text("actor_id").notNull(),
  event: text("event").notNull(),
  entity_id: text("entity_id").notNull(),
  details_json: text("details_json").notNull().default("{}"),
  at: text("at").notNull(),
});

export const lineageWorkImportRuns = sqliteTable("lineage_work_import_runs", {
  id: text("id").primaryKey(),
  checksum: text("checksum").notNull(),
  inserted_count: integer("inserted_count").notNull(),
  existing_count: integer("existing_count").notNull(),
  conflicting_count: integer("conflicting_count").notNull(),
  executed_by: text("executed_by").notNull(),
  executed_at: text("executed_at").notNull(),
});

export const lineageWorkGuard = sqliteTable("lineage_work_guard", {id: text("id").primaryKey(), ok: integer("ok").notNull()});

export const privateAttachments = sqliteTable('private_attachments', {
 id:text('id').primaryKey(), ownerId:text('owner_id').notNull(), inquiryId:text('inquiry_id'),
 name:text('name').notNull(), mime:text('mime').notNull(), data:text('data').notNull(), createdAt:text('created_at').notNull(),
});
export const familyPrograms = sqliteTable('family_programs', {
 id:text('id').primaryKey(), title:text('title').notNull(), kind:text('kind').notNull(), body:text('body').notNull(),
 status:text('status').notNull().default('draft'), startsAt:text('starts_at'), createdBy:text('created_by').notNull(), createdAt:text('created_at').notNull(),
});
export const programParticipants = sqliteTable('program_participants', {
 programId:text('program_id').notNull().references(()=>familyPrograms.id), userId:text('user_id').notNull(),
 note:text('note').notNull().default(''), createdAt:text('created_at').notNull(),
},t=>[primaryKey({columns:[t.programId,t.userId]})]);
export const councilMeetings = sqliteTable('council_meetings', {
 id:text('id').primaryKey(), title:text('title').notNull(), heldAt:text('held_at').notNull(), minutes:text('minutes').notNull(), decisions:text('decisions').notNull(),
 status:text('status').notNull().default('draft'), authorId:text('author_id').notNull(), approvedBy:text('approved_by'),createdAt:text('created_at').notNull(),
});
export const memberInviteTokens = sqliteTable('member_invite_tokens', {
 id:text('id').primaryKey(), memberId:text('member_id').notNull().references(()=>members.id), tokenHash:text('token_hash').notNull().unique(),
 email:text('email').notNull(), expiresAt:text('expires_at').notNull(), consumedAt:text('consumed_at'), createdBy:text('created_by').notNull(),
 delivery:text('delivery').notNull().default('legacy'),
});

export const authAccounts = sqliteTable("auth_accounts", {
  email: text("email").primaryKey(),
  passwordHash: text("password_hash").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const authSessions = sqliteTable("auth_sessions", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  createdAt: text("created_at").notNull(),
  expiresAt: text("expires_at").notNull(),
});

export const passwordResetTokens = sqliteTable("password_reset_tokens", {
  id: text("id").primaryKey(), email: text("email").notNull(), tokenHash: text("token_hash").notNull().unique(),
  expiresAt: text("expires_at").notNull(), consumedAt: text("consumed_at"), createdAt: text("created_at").notNull(),
});
