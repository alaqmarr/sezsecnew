import type { ProfileStatus, Role } from "@/generated/prisma/client";

export interface NavModuleLink {
  id: string;
  path: string;
  label: string | null;
}

export interface NavModuleInfo {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  links: NavModuleLink[];
}

export interface SessionUser {
  id: string;
  username: string;
  name: string | null;
  email: string | null;
  mobile: string | null;
  its: string | null;
  role: Role;
  profileStatus: ProfileStatus | null;
  moduleIds: string[];
  isFloorLeader: boolean;
}

export interface SessionTokenPayload {
  sub: string;
  username: string;
  role: Role;
}
