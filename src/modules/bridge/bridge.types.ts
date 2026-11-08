export interface BridgeEvent {
  id: string;
  reference: string | null;
  name: string;
  mobile: string;
  email: string | null;
  occasionDate: Date;
  occasionDay: string | null;
  occasionTime: string;
  description: string;
  hall: string[];
  catererName: string;
  catererPhone: string;
  decoratorName: string | null;
  decoratorPhone: string | null;
  thaalCount: number;
  totalThaalsDone: number | null;
  sarkariThaalSet: number;
  bhaiSaabIzzan: boolean;
  muraqebeenIzzan?: boolean;
  benSaabIzzan: boolean;
  extraChilamchiLota: number;
  tablesAndChairs: number;
  mic: boolean;
  crockeryRequired: boolean;
  thaalForDevri: boolean;
  paat: boolean;
  masjidLight: boolean;
  crockeryStatus: "PENDING" | "NOT_REQUIRED" | "COMPLETED";
  acStartTime: string | null;
  partyTime: string | null;
  decorations: boolean;
  gasCount: number | null;
  menu: string | null;
  status: "BOOKED" | "CANCELLED" | "COMPLETED";
  eventType: "PUBLIC" | "PRIVATE";
  hallCounts: Record<string, number> | null;
  razaGranted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface BridgeHall {
  id: string;
  name: string;
  width: number | null;
  length: number | null;
}

export interface BridgeInventoryItem {
  id: string;
  name: string;
  category: string;
  totalQuantity: number;
  availableQuantity: number;
  unit: string;
}

export interface BridgeConnectionHealth {
  reachable: boolean;
  targetUrl: string;
  latencyMs: number | null;
  hallCount?: number;
  error?: string;
}
