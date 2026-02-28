import Dexie, { Table } from "dexie";

export type ApiCacheRow = {
  key: string;
  data: unknown;
  updated_at: number;
  ttl_seconds: number;
};

export type SyncQueueRow = {
  id?: number;
  idempotency_key: string;
  entity: string;
  uuid: string;
  action: "create" | "update" | "delete";
  payload: unknown;
  created_at: number;
};

export type SessionRow = {
  id?: number;
  token: string;
  user: unknown;
  cached_at: string;
  expires_at: string;
};

export type RoleRow = {

  uuid: string;
  name: string;
  guard_name?: string | null;
  permissions?: string[];
  updated_at: number;
};

export type CustomerRow = {

  uuid: string;
  name: string;
  fname?: string | null;
  gname?: string | null;
  phone: string;
  phone1?: string | null;
  email?: string | null;
  status?: string | null;
  address?: string | null;
  updated_at: number;
};

export type UserRow = {

  uuid: string;
  name: string;
  password: string;
  roles?: string[];
  email?: string | null;
  updated_at: number;
};

export class LocalDB extends Dexie {
  sync_queue!: Table<SyncQueueRow, number>;
  session!: Table<SessionRow, number>;
  api_cache!: Table<ApiCacheRow, string>;
  customers!: Table<CustomerRow, string>;
  roles!: Table<RoleRow, string>;
  users!: Table<UserRow, string>;
  
  constructor() {
    super("mis_local_db");

    this.version(1).stores({
      sync_queue: "++id, created_at, entity, uuid",
      session: "++id, expires_at",
      api_cache: "&key, updated_at",
    });

    this.version(2).stores({
      sync_queue: "++id, created_at, entity, uuid",
      session: "++id, expires_at",
      api_cache: "&key, updated_at",
      customers: "&uuid, updated_at, phone, name",
      roles: "&uuid, updated_at, name",
      users: "&uuid, updated_at, name,phone",
    });
  }
}

export const db = new LocalDB();
