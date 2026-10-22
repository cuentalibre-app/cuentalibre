import { z } from "zod";

/** A business: every record belongs to one, and users reach it through a membership. */
export const organizationSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  slug: z.string(),
});
export type Organization = z.infer<typeof organizationSchema>;

/** What a member may do in an organization. */
export const membershipRoleSchema = z.enum(["owner", "admin", "member"]);
export type MembershipRole = z.infer<typeof membershipRoleSchema>;

export const membershipSchema = z.object({
  organization: organizationSchema,
  role: membershipRoleSchema,
});
export type Membership = z.infer<typeof membershipSchema>;

/** Someone with access to the organization, as other members see them. */
export const organizationMemberSchema = z.object({
  userId: z.uuid(),
  name: z.string(),
  email: z.email(),
  role: membershipRoleSchema,
  joinedAt: z.iso.datetime(),
});
export type OrganizationMember = z.infer<typeof organizationMemberSchema>;
