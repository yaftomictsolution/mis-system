"use client";

import { Badge } from "@/components/ui/Badge";
import { DataTable, type Column } from "@/components/ui/DataTable";
import type { CrmMessageRow } from "@/modules/crm/crm.repo";

const statusColor: Record<CrmMessageRow["status"], "blue" | "emerald" | "red"> = {
  queued: "blue",
  sent: "emerald",
  failed: "red",
};

type Props = {
  rows: CrmMessageRow[];
  loading: boolean;
  onRetry: (row: CrmMessageRow) => void;
};

function formatDate(value: string | null): string {
  if (!value) return "-";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "-" : d.toLocaleString();
}

export function CrmMessagesTable({ rows, loading, onRetry }: Props) {
  const columns: Column<CrmMessageRow>[] = [
    { key: "customer_name", label: "Customer" },
    { key: "channel", label: "Channel", render: (item) => <span className="uppercase">{item.channel}</span> },
    { key: "message_type", label: "Message Type" },
    { key: "installment_due_date", label: "Due Date", render: (item) => item.installment_due_date ?? "-" },
    { key: "status", label: "Status", render: (item) => <Badge color={statusColor[item.status]}>{item.status}</Badge> },
    { key: "error_message", label: "Result", render: (item) => item.error_message ?? "Sent" },
    { key: "sent_at", label: "Sent At", render: (item) => formatDate(item.sent_at) },
  ];

  return (
    <DataTable
      columns={columns}
      data={rows}
      loading={loading}
      searchKeys={["customer_name", "channel", "message_type", "status", "error_message", "installment_due_date"]}
      onView={(row) => {
        if (row.status === "failed") onRetry(row);
      }}
    />
  );
}
