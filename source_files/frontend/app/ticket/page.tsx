"use client";
export const dynamic = "force-dynamic";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  getTicketDetails,
  TicketDetails,
  getArchivedTicketDetails,
  getCurrentUser,
  ApiUser,
  getDepartments,
  Department,
  getUsers,
  updateTicket,
  archiveTicket,
} from "../../lib/api";
import Header from "../componenets/ticket/header";
import Description from "../componenets/ticket/description";
import TestimonialWall from "../componenets/ticket/details";
import Chain from "../componenets/ticket/response";
import LogoutButton from "../componenets/LogoutButton";
import NewResponse from "../componenets/ticket/newResponse";

const statusOptions = [
  { value: "OPEN", label: "Open" },
  { value: "AWAITING_ASSIGNEE", label: "Awaiting advisor" },
  { value: "AWAITING_AUTHOR", label: "Awaiting student" },
  { value: "CLOSED", label: "Closed" },
  { value: "ARCHIVED", label: "Archived" },
];

type EditorProps = {
  ticketId: number;
  ticket: TicketDetails;
  user: ApiUser;
  onUpdated: () => Promise<void> | void;
  onArchived?: () => Promise<void> | void;
};

const formatDepartmentLabel = (label?: string | null) => {
  if (!label) return "";
  const spaced = label.replace(/_/g, " ").trim();
  return spaced
    .split(" ")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
};

function TicketEditor({ ticketId, ticket, user, onUpdated, onArchived }: EditorProps) {
  const initialDepartmentId =
    ticket.department_id ??
    (ticket.department && !Number.isNaN(Number(ticket.department))
      ? Number(ticket.department)
      : null);
  const initialAssigneeId = ticket.assignee_id ?? null;

  const [subject, setSubject] = useState(ticket.subject);
  const [message, setMessage] = useState(ticket.body);
  const [departmentId, setDepartmentId] = useState(
    initialDepartmentId !== null ? String(initialDepartmentId) : ""
  );
  const [priority, setPriority] = useState(
    ticket.priority !== null && ticket.priority !== undefined
      ? String(ticket.priority)
      : ""
  );
  const [assigneeId, setAssigneeId] = useState(
    initialAssigneeId !== null ? String(initialAssigneeId) : ""
  );
  const [status, setStatus] = useState(ticket.status || "OPEN");
  const [departments, setDepartments] = useState<Department[]>([]);
  const [staff, setStaff] = useState<ApiUser[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const isAdvisor = user.role === "advisor" || user.role === "admin";

  useEffect(() => {
    const nextDepartmentId =
      ticket.department_id ??
      (ticket.department && !Number.isNaN(Number(ticket.department))
        ? Number(ticket.department)
        : null);
    const nextAssigneeId = ticket.assignee_id ?? null;

    setSubject(ticket.subject);
    setMessage(ticket.body);
    setDepartmentId(nextDepartmentId !== null ? String(nextDepartmentId) : "");
    setPriority(
      ticket.priority !== null && ticket.priority !== undefined
        ? String(ticket.priority)
        : ""
    );
    setAssigneeId(nextAssigneeId !== null ? String(nextAssigneeId) : "");
    setStatus(ticket.status || "OPEN");
  }, [ticket]);

  useEffect(() => {
    const loadMeta = async () => {
      try {
        const [deptData, staffData] = await Promise.all([
          getDepartments(),
          isAdvisor
            ? getUsers({ role: "advisor", per_page: 100 })
            : Promise.resolve(null),
        ]);

        setDepartments(deptData);
        if (staffData) {
          setStaff(staffData.users);
        }
      } catch (err) {
        console.error("Failed to fetch supporting data", err);
      }
    };

    loadMeta();
  }, [isAdvisor]);

  const departmentOptions = useMemo(() => {
    const opts = departments.map((dept) => ({
      value: String(dept.department_id),
      label: formatDepartmentLabel(dept.name) || `Department ${dept.department_id}`,
    }));

    if (
      ticket.department_id &&
      !opts.some((opt) => opt.value === String(ticket.department_id))
    ) {
      // Ensure the current department stays selectable even if it is not returned by the list API.
      opts.unshift({
        value: String(ticket.department_id),
        label:
          formatDepartmentLabel(ticket.department) ||
          `Department ${ticket.department_id}`,
      });
    }

    return opts;
  }, [departments, ticket.department, ticket.department_id]);

  const assigneeOptions = useMemo(() => {
    if (!isAdvisor) return [];
    const opts = staff.map((member) => ({
      value: String(member.user_id),
      label: member.display_name,
    }));

    if (
      ticket.assignee_id &&
      !opts.some((opt) => opt.value === String(ticket.assignee_id))
    ) {
      // Preserve current assignee if it was not part of the advisor list fetch.
      opts.unshift({
        value: String(ticket.assignee_id),
        label: ticket.assignee || `User ${ticket.assignee_id}`,
      });
    }

    return opts;
  }, [isAdvisor, staff, ticket.assignee, ticket.assignee_id]);

  useEffect(() => {
    if (!departmentId && initialDepartmentId !== null) {
      setDepartmentId(String(initialDepartmentId));
    }
    if (isAdvisor && assigneeId === "" && initialAssigneeId !== null) {
      setAssigneeId(String(initialAssigneeId));
    }
  }, [departmentId, assigneeId, initialDepartmentId, initialAssigneeId, isAdvisor]);

  useEffect(() => {
    if (
      initialDepartmentId !== null &&
      !departmentOptions.some((opt) => opt.value === String(initialDepartmentId))
    ) {
      setDepartmentId(String(initialDepartmentId));
    }
    if (
      isAdvisor &&
      initialAssigneeId !== null &&
      !assigneeOptions.some((opt) => opt.value === String(initialAssigneeId))
    ) {
      setAssigneeId(String(initialAssigneeId));
    }
  }, [departmentOptions, assigneeOptions, initialDepartmentId, initialAssigneeId, isAdvisor]);

  // Backfill department/assignee by name if ids weren't present in payload
  useEffect(() => {
    if (!departmentId && ticket.department && departments.length > 0) {
      const match = departments.find(
        (dept) =>
          formatDepartmentLabel(dept.name).toLowerCase() ===
          formatDepartmentLabel(ticket.department).toLowerCase()
      );
      if (match) {
        setDepartmentId(String(match.department_id));
      }
    }

    if (
      isAdvisor &&
      !assigneeId &&
      ticket.assignee &&
      staff.length > 0
    ) {
      const match = staff.find(
        (member) =>
          member.display_name.trim().toLowerCase() ===
          ticket.assignee!.trim().toLowerCase()
      );
      if (match) {
        setAssigneeId(String(match.user_id));
      }
    }
  }, [departmentId, assigneeId, ticket.department, ticket.assignee, departments, staff, isAdvisor]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    const archiveMode = status === "ARCHIVED";

    setSaving(true);
    try {
      const payload: Parameters<typeof updateTicket>[0] = {
        ticket_id: ticketId,
        subject: subject.trim(),
        message: message.trim(),
      };

      const resolvedDepartment = departmentValue
        ? Number(departmentValue)
        : initialDepartmentId;
      if (resolvedDepartment !== null && !Number.isNaN(resolvedDepartment)) {
        payload.department = resolvedDepartment;
      } else {
        setError("Department is required.");
        setSaving(false);
        return;
      }

      if (isAdvisor) {
        const resolvedPriority =
          priority !== "" && priority !== null
            ? Number(priority)
            : ticket.priority ?? null;
        payload.priority = resolvedPriority;

        const resolvedAssignee =
          assigneeId !== "" ? Number(assigneeId) : ticket.assignee_id ?? null;
        payload.assignee = resolvedAssignee;

        if (!archiveMode) {
          payload.status = status || ticket.status || "OPEN";
        }
      }

      await updateTicket(payload);
      if (archiveMode) {
        await archiveTicket(ticketId);
        setSuccess("Ticket archived and removed from the active queue.");
        if (onArchived) {
          await onArchived();
        }
        return;
      }

      setSuccess("Ticket updated successfully.");
      await onUpdated();
    } catch (err) {
      const fallback = archiveMode
        ? "Failed to archive ticket"
        : "Failed to update ticket";
      setError(err instanceof Error ? err.message : fallback);
    } finally {
      setSaving(false);
    }
  };

  const statusLabel =
    statusOptions.find((opt) => opt.value === status)?.label || "Open";

  const departmentValue =
    departmentId ||
    (initialDepartmentId !== null ? String(initialDepartmentId) : "");
  const assigneeValue =
    assigneeId || (initialAssigneeId !== null ? String(initialAssigneeId) : "");

  return (
    <section className="px-6 pb-8">
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <form className="space-y-4 p-6" onSubmit={handleSubmit}>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">
              Edit ticket
            </h2>
            <p className="text-sm text-slate-500">
              Status:{" "}
              <span className="font-semibold text-slate-800">{statusLabel}</span>
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-800">
              Subject
            </label>
            <input
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-[#007030] focus:outline-none focus:ring-2 focus:ring-[#007030]/20"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Enter subject"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-800">
              Department
            </label>
            <select
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#007030] focus:outline-none focus:ring-2 focus:ring-[#007030]/20"
              value={departmentValue}
              onChange={(e) => setDepartmentId(e.target.value)}
            >
              <option value="">Select department</option>
              {departmentValue &&
                !departmentOptions.some((opt) => opt.value === departmentValue) && (
                  <option value={departmentValue}>
                    {formatDepartmentLabel(ticket.department) ||
                      `Department ${departmentValue}`}
                  </option>
                )}
              {departmentOptions.map((dept) => (
                <option key={dept.value} value={dept.value}>
                  {dept.label}
                </option>
              ))}
            </select>
          </div>

          {isAdvisor ? (
            <>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-800">
                  Priority
                </label>
                <select
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#007030] focus:outline-none focus:ring-2 focus:ring-[#007030]/20"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                >
                  <option value="">Unset</option>
                  <option value="3">High</option>
                  <option value="2">Medium</option>
                  <option value="1">Low</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-800">
                  Assignee
                </label>
                <select
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#007030] focus:outline-none focus:ring-2 focus:ring-[#007030]/20"
                  value={assigneeValue}
                  onChange={(e) => setAssigneeId(e.target.value)}
                >
                  <option value="">Unassigned</option>
                  {assigneeValue &&
                    !assigneeOptions.some((opt) => opt.value === assigneeValue) && (
                      <option value={assigneeValue}>
                        {ticket.assignee || `User ${assigneeValue}`}
                      </option>
                    )}
                  {assigneeOptions.map((member) => (
                    <option key={member.value} value={member.value}>
                      {member.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-800">
                  Status
                </label>
                <select
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#007030] focus:outline-none focus:ring-2 focus:ring-[#007030]/20"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  {statusOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </>
          ) : null}

          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-800">
              Description
            </label>
            <textarea
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-[#007030] focus:outline-none focus:ring-2 focus:ring-[#007030]/20"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-[#007030] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#104735] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save changes"}
            </button>
          </div>

          {error ? <p className="text-sm text-rose-600">{error}</p> : null}
          {success ? <p className="text-sm text-emerald-600">{success}</p> : null}
        </form>
      </div>
    </section>
  );
}

export default function TicketPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const ticketId = searchParams.get("id");
  const isArchivedView =
    searchParams.get("archived") === "1" ||
    searchParams.get("archived")?.toLowerCase() === "true" ||
    searchParams.get("view") === "archived";
  const [ticketDetails, setTicketDetails] = useState<TicketDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<ApiUser | null>(null);
  const backTarget = isArchivedView ? "/?view=archived" : "/";

  const fetchTicket = useCallback(async () => {
    if (!ticketId) {
      setError("No ticket ID provided");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      // Choose the correct endpoint based on archived flag in the URL.
      const details = isArchivedView
        ? await getArchivedTicketDetails(ticketId)
        : await getTicketDetails(ticketId);
      setTicketDetails(details);
      console.log("Fetched ticket details:", details);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load ticket");
      console.error("Error fetching ticket:", err);
    } finally {
      setLoading(false);
    }
  }, [ticketId, isArchivedView]);

  useEffect(() => {
    fetchTicket();
  }, [fetchTicket]);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const apiUser = await getCurrentUser();
        if (apiUser) {
          setUser(apiUser);
        }
      } catch (err) {
        console.error("Failed to fetch current user", err);
      }
    };

    fetchUser();
  }, []);

  const handleArchivedRedirect = useCallback(() => {
    router.push("/?view=archived");
  }, [router]);

  const handleBack = useCallback(() => {
    router.push(backTarget);
  }, [router, backTarget]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-slate-600">Loading ticket...</div>
      </div>
    );
  }

  if (error || !ticketDetails) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-red-500">
          <p>Error: {error || "Ticket not found"}</p>
        </div>
      </div>
    );
  }

  const statusMap: Record<string, string> = {
    OPEN: "open",
    CLOSED: "closed",
    AWAITING_AUTHOR: "awaiting_author",
    AWAITING_ASSIGNEE: "awaiting_assignee",
    ARCHIVED: "archived",
  };

  const status = ticketDetails.status
    ? statusMap[ticketDetails.status] || "open"
    : "open";

  const numericTicketId = Number(
    ticketDetails.ticket_id ?? ticketId ?? Number.NaN
  );

  return (
    <>
      <div className="fixed bg-white left-0 right-0 top-0 z-40 border-b border-slate-200">
        <div className="px-4 sm:px-6 lg:px-12 py-4 flex items-center justify-between">
          <button
            type="button"
            onClick={handleBack}
            className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            ← Back
          </button>
          <LogoutButton />
        </div>
      </div>
      
      <div className="pt-[80px] px-4 sm:px-6 lg:px-12 pb-8">
        <Header
          title={ticketDetails.subject}
          ticketId={ticketId || ""}
          status={status}
        />
        {isArchivedView ? (
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 mt-6">
            This ticket has been archived and is read-only. Head back to the archived
            queue to browse other archived tickets.
            <div className="mt-3">
              <button
                type="button"
                onClick={handleArchivedRedirect}
                className="rounded-md border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
              >
                View archived tickets
              </button>
            </div>
          </div>
        ) : user ? (
          <TicketEditor
            ticketId={numericTicketId as number}
            ticket={ticketDetails}
            user={user}
            onUpdated={fetchTicket}
            onArchived={handleArchivedRedirect}
          />
        ) : (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 mt-6">
            Log in to edit ticket details. Status is still visible above.
          </div>
        )}
        <Description description={ticketDetails.body} />
        <TestimonialWall
          assignee={ticketDetails.assignee}
          lastUpdated={ticketDetails.last_updated}
          modifiedBy={ticketDetails.assignee || ticketDetails.author}
          department={ticketDetails.department}
          requester={ticketDetails.author}
          createdAt={ticketDetails.created_at}
          studentNumber={ticketDetails.author_id}
        />
        <NewResponse ticketId={numericTicketId as number} onSubmitted={fetchTicket} />
        <Chain responses={ticketDetails.responses} />
      </div>
    </>
  );
}
