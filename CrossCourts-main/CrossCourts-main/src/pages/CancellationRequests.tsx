import React, { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";
import Breadcrumb from "../components/Breadcrumbs/Breadcrumb";

const API_BASE = "http://localhost:5000/api";

const getScope = () =>
  window.location.pathname.startsWith("/admin") ? "admin" : "operator";

type CancellationRow = {
  id: number;
  booking_id: number;
  arena_id: number | null;
  customer_email: string;
  customer_name: string | null;
  court_name: string | null;
  arena_name: string | null;
  booking_date: string | null;
  start_time: string | null;
  end_time: string | null;
  customer_note: string | null;
  status: "pending" | "approved" | "denied";
  operator_note: string | null;
  created_at: string;
  resolved_at: string | null;
  booking_email_live?: string | null;
  booking_name_live?: string | null;
};

const formatTime = (t: string | null | undefined) =>
  t ? String(t).slice(0, 5) : "—";

const CancellationRequests: React.FC = () => {
  const scope = getScope();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<"pending" | "all" | "approved" | "denied">("pending");
  const [denyId, setDenyId] = useState<number | null>(null);
  const [denyNote, setDenyNote] = useState("");

  const listQuery = useQuery({
    queryKey: ["cancellationRequests", scope, filter],
    queryFn: async () => {
      const q = filter === "all" ? "status=all" : `status=${filter}`;
      const res = await fetch(`${API_BASE}/${scope}/cancellation-requests?${q}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load requests");
      return json as { requests: CancellationRow[]; pendingCount: number };
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (requestId: number) => {
      const res = await fetch(
        `${API_BASE}/${scope}/cancellation-requests/${requestId}/approve`,
        { method: "POST", headers: { "Content-Type": "application/json" } },
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Approve failed");
      return json;
    },
    onSuccess: () => {
      toast.success("Cancellation approved. Booking removed.");
      queryClient.invalidateQueries({ queryKey: ["cancellationRequests"] });
      queryClient.invalidateQueries({ queryKey: ["cancellationPendingCount"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const denyMutation = useMutation({
    mutationFn: async ({ requestId, note }: { requestId: number; note: string }) => {
      const res = await fetch(
        `${API_BASE}/${scope}/cancellation-requests/${requestId}/deny`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ operator_note: note || null }),
        },
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Deny failed");
      return json;
    },
    onSuccess: () => {
      toast.success("Request denied. Customer keeps the booking.");
      setDenyId(null);
      setDenyNote("");
      queryClient.invalidateQueries({ queryKey: ["cancellationRequests"] });
      queryClient.invalidateQueries({ queryKey: ["cancellationPendingCount"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = listQuery.data?.requests ?? [];
  const pendingCount = listQuery.data?.pendingCount ?? 0;

  return (
    <>
      <Breadcrumb pageName="Cancellation requests" />

      <div className="mb-6 rounded-lg border border-stroke bg-white p-4 shadow-default dark:border-strokedark dark:bg-boxdark">
        <p className="text-sm text-body-color dark:text-bodydark">
          When customers click <strong>Request cancellation</strong> on My Bookings, requests
          appear here. <strong>Approve</strong> removes the booking and frees the slot.{" "}
          <strong>Deny</strong> keeps the booking; you can add an optional note for the customer.
        </p>
        {pendingCount > 0 ? (
          <p className="mt-2 text-sm font-medium text-amber-700 dark:text-amber-400">
            {pendingCount} pending request{pendingCount === 1 ? "" : "s"} need review.
          </p>
        ) : null}
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {(
          [
            ["pending", "Pending"],
            ["all", "All"],
            ["approved", "Approved"],
            ["denied", "Denied"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setFilter(value)}
            className={`rounded-lg px-4 py-2 text-sm font-medium ${
              filter === value
                ? "bg-primary text-white"
                : "border border-stroke bg-white dark:border-strokedark dark:bg-boxdark"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {listQuery.isLoading ? (
        <p className="text-sm text-body-color">Loading…</p>
      ) : listQuery.isError ? (
        <p className="text-sm text-red-600">{(listQuery.error as Error).message}</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-body-color">No requests in this view.</p>
      ) : (
        <div className="overflow-x-auto rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-stroke bg-gray-2 dark:border-strokedark dark:bg-meta-4">
              <tr>
                <th className="px-4 py-3 font-medium">ID</th>
                <th className="px-4 py-3 font-medium">Booking</th>
                <th className="px-4 py-3 font-medium">Arena / court</th>
                <th className="px-4 py-3 font-medium">When</th>
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium">Note</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.id}
                  className="border-b border-stroke dark:border-strokedark"
                >
                  <td className="px-4 py-3 font-mono text-xs">{r.id}</td>
                  <td className="px-4 py-3 font-mono text-xs">#{r.booking_id}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-black dark:text-white">
                      {r.arena_name || "—"}
                    </div>
                    <div className="text-xs text-body-color">{r.court_name || "—"}</div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {r.booking_date || "—"}{" "}
                    <span className="text-body-color">
                      {formatTime(r.start_time)}–{formatTime(r.end_time)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div>{r.customer_name || r.booking_name_live || "—"}</div>
                    <div className="text-xs text-body-color">{r.customer_email}</div>
                  </td>
                  <td className="max-w-[180px] px-4 py-3 text-xs text-body-color">
                    {r.customer_note || "—"}
                    {r.status === "denied" && r.operator_note ? (
                      <div className="mt-1 text-amber-800 dark:text-amber-200">
                        Op: {r.operator_note}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        r.status === "pending"
                          ? "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100"
                          : r.status === "approved"
                            ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-100"
                            : "bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-100"
                      }`}
                    >
                      {r.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {r.status === "pending" ? (
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="rounded bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-700"
                          onClick={() => {
                            if (
                              window.confirm(
                                "Approve and cancel this booking? The slot will open again.",
                              )
                            ) {
                              approveMutation.mutate(r.id);
                            }
                          }}
                          disabled={approveMutation.isPending}
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          className="rounded border border-stroke px-3 py-1 text-xs dark:border-strokedark"
                          onClick={() => {
                            setDenyId(r.id);
                            setDenyNote("");
                          }}
                        >
                          Deny
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-body-color">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {denyId != null ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg border border-stroke bg-white p-6 shadow-lg dark:border-strokedark dark:bg-boxdark">
            <h3 className="mb-2 text-lg font-semibold text-black dark:text-white">
              Deny cancellation request #{denyId}
            </h3>
            <p className="mb-3 text-sm text-body-color dark:text-bodydark">
              Optional message to the customer (e.g. policy window closed).
            </p>
            <textarea
              value={denyNote}
              onChange={(e) => setDenyNote(e.target.value)}
              rows={3}
              className="mb-4 w-full rounded border border-stroke px-3 py-2 dark:border-strokedark"
              placeholder="Optional note…"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="rounded border border-stroke px-4 py-2 text-sm dark:border-strokedark"
                onClick={() => setDenyId(null)}
              >
                Close
              </button>
              <button
                type="button"
                className="rounded bg-primary px-4 py-2 text-sm font-medium text-white"
                disabled={denyMutation.isPending}
                onClick={() => denyMutation.mutate({ requestId: denyId, note: denyNote })}
              >
                Confirm deny
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
};

export default CancellationRequests;
