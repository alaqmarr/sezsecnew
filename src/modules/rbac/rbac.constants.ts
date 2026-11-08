export interface DefaultModuleSeed {
  id: string;
  name: string;
  description: string;
  icon: string;
  links: Array<{ path: string; label: string; order: number }>;
}

export const EVENT_CHARGES_MODULE_ID = "event_charges";
export const VIEW_PRIVATE_EVENTS_MODULE_ID = "view-private-events-sezsecorg";
export const UPDATE_THAAL_COUNT_MODULE_ID = "update-thaal-count-sezsecorg";

export const DEFAULT_SEZSEC_MODULES: readonly DefaultModuleSeed[] = [
  {
    id: "accounts-overview",
    name: "Accounts Dashboard",
    description: "View financial collections, outstanding member balances, and transaction ledger",
    icon: "Landmark",
    links: [{ path: "/admin/accounts", label: "Accounts Overview", order: 0 }],
  },
  {
    id: "manage-fees",
    name: "Fees & Event Funds",
    description: "Generate monthly contributions, event funds, and record/revoke member payments",
    icon: "Wallet",
    links: [{ path: "/admin/fees", label: "Manage Fees & Funds", order: 0 }],
  },
  {
    id: "attendance-admin",
    name: "Attendance Sessions & Analytics",
    description: "Start/stop miqaat attendance windows and inspect attendee analytics",
    icon: "CalendarCheck2",
    links: [
      { path: "/admin/attendance", label: "Attendance Sessions", order: 0 },
      { path: "/admin/attendance-details", label: "Master Attendance Log", order: 1 },
      { path: "/admin/attendance-details/[id]", label: "Event Attendees", order: 2 },
    ],
  },
  {
    id: "take-attendance",
    name: "Take Live Attendance",
    description: "Mark floor members present, absent, or excused during active miqaats",
    icon: "UserCheck",
    links: [{ path: "/admin/take-attendance", label: "Take Attendance", order: 0 }],
  },
  {
    id: "manage-floors",
    name: "Floor Hierarchy",
    description: "Configure floors and assign Floor Heads, Sub-Heads, and Members",
    icon: "Layers",
    links: [{ path: "/admin/floors", label: "Floor Hierarchy", order: 0 }],
  },
  {
    id: "manage-users",
    name: "Members Directory",
    description: "Create, bulk import, and manage member accounts and roles",
    icon: "Users",
    links: [{ path: "/admin/users", label: "Members Directory", order: 0 }],
  },
  {
    id: "edit-member-details",
    name: "Edit Member Details",
    description: "Search members by ITS/username and update profile credentials",
    icon: "UserCog",
    links: [{ path: "/admin/edit-user", label: "Edit Member", order: 0 }],
  },
  {
    id: "member-applications",
    name: "Committee Registrations",
    description: "Review, approve, and provision new committee member applications",
    icon: "UserPlus",
    links: [{ path: "/admin/members", label: "Member Registrations", order: 0 }],
  },
  {
    id: "khidmat-requests",
    name: "Khidmat Invitations",
    description: "Review and approve community khidmat requests",
    icon: "HandHeart",
    links: [{ path: "/admin/khidmat", label: "Khidmat Requests", order: 0 }],
  },
  {
    id: "manage-banners",
    name: "Homepage Banners",
    description: "Upload banners and configure countdown overlays on the home hero",
    icon: "Image",
    links: [{ path: "/admin/banners", label: "Homepage Banners", order: 0 }],
  },
  {
    id: "manage-blogs",
    name: "Community Chronicles",
    description: "Publish and manage community stories and announcements",
    icon: "BookOpen",
    links: [
      { path: "/admin/blogs", label: "All Chronicles", order: 0 },
      { path: "/admin/blogs/new", label: "New Chronicle", order: 1 },
    ],
  },
  {
    id: "messages-broadcast",
    name: "Announcements & Broadcasts",
    description: "Post member portal notices and dispatch committee email broadcasts",
    icon: "Megaphone",
    links: [{ path: "/admin/messages", label: "Announcements", order: 0 }],
  },
  {
    id: "data-exports",
    name: "Excel & Ledger Exports",
    description: "Export member directory, fee matrices, accounts, and miqaat attendance to Excel",
    icon: "FileSpreadsheet",
    links: [{ path: "/admin/exports", label: "Data Exports", order: 0 }],
  },
  {
    id: "manage-modules",
    name: "RBAC Modules",
    description: "Configure access modules and generate hall/charges permissions",
    icon: "Blocks",
    links: [{ path: "/admin/modules", label: "RBAC Modules", order: 0 }],
  },
  {
    id: "manage-access",
    name: "User Access Permissions",
    description: "Assign and revoke module permissions for individual members",
    icon: "ShieldCheck",
    links: [
      { path: "/admin/manage-access", label: "Manage Access", order: 0 },
      { path: "/admin/manage-access/[userId]", label: "Edit User Access", order: 1 },
    ],
  },
  {
    id: "system-settings",
    name: "System, Bridge & SMTP Settings",
    description: "Manage internal 127.0.0.1:3333 bridge, SMTP, UPI QR, and database backups",
    icon: "Settings",
    links: [{ path: "/admin/settings", label: "System Settings", order: 0 }],
  },
  {
    id: VIEW_PRIVATE_EVENTS_MODULE_ID,
    name: "View Private Events on Calendar",
    description: "Allows viewing private family functions alongside public miqaats on /events",
    icon: "Calendar",
    links: [],
  },
  {
    id: UPDATE_THAAL_COUNT_MODULE_ID,
    name: "Global Thaal Count Entry",
    description: "Allows entering actual thaals served across all halls on /menu",
    icon: "Utensils",
    links: [],
  },
  {
    id: EVENT_CHARGES_MODULE_ID,
    name: "Event Charges (Events Portal OTP)",
    description: "Allows viewing, editing, and printing booking rupee charges via 6-digit OTP on Jamaat Events",
    icon: "IndianRupee",
    links: [],
  },
] as const;

export const SELF_SERVICE_MEMBER_PATHS = new Set([
  "/profile",
  "/fees",
  "/admin/team",
  "/admin/my-attendance-history",
  "/admin/contributions",
  "/admin/contribution-history",
]);
