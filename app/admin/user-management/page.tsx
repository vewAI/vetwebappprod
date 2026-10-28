"use client";

import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth/services/authService";
import { getAccessToken } from "@/lib/auth-headers";
import { Badge } from "@/components/ui/badge";
import type { Institution } from "@/features/admin/components/InstitutionManagement";
import type { YearGroup } from "@/features/year-groups/models/yearGroup";
import { Breadcrumb } from "@/features/navigation/components/breadcrumb";
import { Modal } from "@/features/navigation/components/modal";
import { Select } from "@/features/navigation/components/select";
import { SortHeader } from "@/features/navigation/components/sort-header";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/features/navigation/components/table";
import { useTableSort } from "@/features/navigation/hooks/useTableSort";

type UserProfile = {
  id: string;
  user_id: string;
  email: string;
  full_name?: string | null;
  role: string;
  created_at: string;
  institution_id?: string | null;
  institutions?: { name: string } | null;
  year_group_id?: string | null;
  year_groups?: { id: string; name: string } | null;
};

type UserSortKey = "email" | "role" | "institution" | "year" | "created";

const ROLE_OPTIONS = [
  { value: "all", label: "All Roles" },
  { value: "student", label: "Student" },
  { value: "professor", label: "Professor" },
  { value: "admin", label: "Admin" },
];

const FIELD_INPUT_CLASS =
  "h-11 w-full appearance-none rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-300 focus:outline-none focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30 dark:focus:border-brand-800";

function FieldLabel({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-400">
      {children}
    </label>
  );
}

function roleBadgeVariant(role: string) {
  if (role === "admin") return "brand" as const;
  if (role === "professor") return "default" as const;
  return "secondary" as const;
}

export default function UserManagementPage() {
  const { role: userRole } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [yearGroups, setYearGroups] = useState<YearGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [emailSearch, setEmailSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [yearFilter, setYearFilter] = useState("all");

  const [isUserDialogOpen, setIsUserDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [userForm, setUserForm] = useState({
    email: "",
    password: "",
    fullName: "",
    role: "student",
    institution_id: "",
    year_group_id: "",
  });
  const [userSubmitting, setUserSubmitting] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const token = await getAccessToken();
      const headers = { Authorization: `Bearer ${token}` };

      const [usersRes, instRes, yearRes] = await Promise.all([
        axios.get<{ users: UserProfile[] }>("/api/admin/users", { headers }).catch(() => ({ data: { users: [] } })),
        axios.get<{ institutions: Institution[] }>("/api/admin/institutions", { headers }).catch(() => ({ data: { institutions: [] } })),
        axios.get<{ yearGroups: YearGroup[] }>("/api/year-groups", { headers }).catch(() => ({ data: { yearGroups: [] } })),
      ]);

      setUsers(usersRes.data.users || []);
      setInstitutions(instRes.data.institutions || []);
      setYearGroups(yearRes.data.yearGroups || []);
    } catch (err: unknown) {
      const requestError = err as { response?: { data?: { error?: string } }; message?: string };
      setError(requestError.response?.data?.error || requestError.message || "Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  const handleUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setUserSubmitting(true);
      const token = await getAccessToken();
      const headers = { Authorization: `Bearer ${token}` };

      const payload: Record<string, unknown> = {
        email: userForm.email,
        role: userForm.role,
        institution_id: userForm.institution_id || null,
        year_group_id: userForm.role === "student" ? userForm.year_group_id || null : null,
      };
      if (userForm.password.trim()) payload.password = userForm.password;
      if (userForm.fullName.trim()) payload.fullName = userForm.fullName.trim();

      if (editingUser) {
        await axios.put("/api/admin/users", { ...payload, userId: editingUser.user_id }, { headers });
      } else {
        await axios.post("/api/admin/users", { ...payload, password: userForm.password, fullName: userForm.fullName.trim() }, { headers });
      }

      setIsUserDialogOpen(false);
      resetUserForm();
      await fetchData();
    } catch (err: unknown) {
      const requestError = err as { response?: { data?: { error?: string } }; message?: string };
      alert(requestError.response?.data?.error || requestError.message);
    } finally {
      setUserSubmitting(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm("Are you sure you want to delete this user?")) return;
    try {
      const token = await getAccessToken();
      await axios.delete(`/api/admin/users?userId=${userId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      await fetchData();
    } catch (err: unknown) {
      const requestError = err as { response?: { data?: { error?: string } }; message?: string };
      alert(requestError.response?.data?.error || requestError.message);
    }
  };

  const resetUserForm = () => {
    setEditingUser(null);
    setUserForm({
      email: "",
      password: "",
      fullName: "",
      role: "student",
      institution_id: "",
      year_group_id: "",
    });
  };

  const openEditUser = (user: UserProfile) => {
    setEditingUser(user);
    setUserForm({
      email: user.email,
      password: "",
      fullName: user.full_name || "",
      role: user.role,
      institution_id: user.institution_id || "",
      year_group_id: user.year_group_id || user.year_groups?.id || "",
    });
    setIsUserDialogOpen(true);
  };

  const yearFilterOptions = useMemo(() => {
    const showInstitution = new Set(yearGroups.map((group) => group.institutionId)).size > 1;
    return [
      { value: "all", label: "All Year Groups" },
      { value: "unassigned", label: "Unassigned" },
      ...yearGroups.map((group) => ({
        value: group.id,
        label: showInstitution && group.institutionName ? `${group.institutionName} — ${group.name}` : group.name,
      })),
    ];
  }, [yearGroups]);

  const filteredUsers = useMemo(() => {
    const query = emailSearch.trim().toLowerCase();
    return users.filter((user) => {
      if (query && !user.email.toLowerCase().includes(query)) return false;
      if (roleFilter !== "all" && user.role !== roleFilter) return false;
      const userYearId = user.year_group_id || user.year_groups?.id || "";
      if (yearFilter === "unassigned" && userYearId) return false;
      if (yearFilter !== "all" && yearFilter !== "unassigned" && userYearId !== yearFilter) return false;
      return true;
    });
  }, [users, emailSearch, roleFilter, yearFilter]);

  const { sort, toggle, sorted: sortedUsers } = useTableSort<UserProfile, UserSortKey>(
    filteredUsers,
    (user, key) => {
      if (key === "email") return user.email;
      if (key === "role") return user.role;
      if (key === "institution") return user.institutions?.name || "";
      if (key === "year") return user.year_groups?.name || "";
      return new Date(user.created_at).getTime();
    },
    { key: "email", dir: "asc" },
  );

  const closeUserModal = () => {
    if (userSubmitting) return;
    setIsUserDialogOpen(false);
    resetUserForm();
  };

  const yearGroupOptions = [
    { value: "", label: userForm.institution_id ? "Unassigned" : "Select an institution first" },
    ...yearGroups
      .filter((group) => group.institutionId === userForm.institution_id)
      .map((group) => ({ value: group.id, label: group.name })),
  ];

  const userDialog = (
    <Modal isOpen={isUserDialogOpen} onClose={closeUserModal} className="max-w-[36.5rem] p-5 lg:p-10">
      <form onSubmit={handleUserSubmit}>
        <h4 className="mb-2 pr-12 text-lg font-medium text-gray-800 dark:text-white/90">
          {editingUser ? "Edit User" : "Create New User"}
        </h4>
        <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">
          {editingUser ? "Update this account's details." : "Add a new user account."}
        </p>
        <div className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
          <div className="col-span-1">
            <FieldLabel htmlFor="user-email">Email</FieldLabel>
            <input
              id="user-email"
              type="email"
              required
              value={userForm.email}
              onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
              placeholder="name@example.com"
              className={FIELD_INPUT_CLASS}
            />
          </div>
          <div className="col-span-1">
            <FieldLabel htmlFor="user-full-name">Full Name</FieldLabel>
            <input
              id="user-full-name"
              type="text"
              value={userForm.fullName}
              onChange={(e) => setUserForm({ ...userForm, fullName: e.target.value })}
              placeholder="Optional"
              className={FIELD_INPUT_CLASS}
            />
          </div>
          <div className="col-span-1">
            <FieldLabel htmlFor="user-password">Password</FieldLabel>
            <input
              id="user-password"
              type="password"
              required={!editingUser}
              value={userForm.password}
              onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
              placeholder={editingUser ? "Leave blank to keep current" : "Enter a password"}
              className={FIELD_INPUT_CLASS}
            />
          </div>
          <div className="col-span-1">
            <FieldLabel htmlFor="user-role">Role</FieldLabel>
            <Select
              id="user-role"
              value={userForm.role}
              onChange={(role) =>
                setUserForm({
                  ...userForm,
                  role,
                  year_group_id: role === "student" ? userForm.year_group_id : "",
                })
              }
              options={[
                { value: "student", label: "Student" },
                { value: "professor", label: "Professor" },
                { value: "admin", label: "Admin" },
              ]}
            />
          </div>
          <div className={userForm.role === "student" ? "col-span-1" : "col-span-1 sm:col-span-2"}>
            <FieldLabel htmlFor="user-institution">Institution</FieldLabel>
            <Select
              id="user-institution"
              value={userForm.institution_id}
              onChange={(institution_id) => setUserForm({ ...userForm, institution_id, year_group_id: "" })}
              options={[
                { value: "", label: "None" },
                ...institutions.map((inst) => ({ value: inst.id, label: inst.name })),
              ]}
            />
          </div>
          {userForm.role === "student" ? (
            <div className="col-span-1">
              <FieldLabel htmlFor="user-year-group">Year group</FieldLabel>
              <Select
                id="user-year-group"
                value={userForm.year_group_id}
                onChange={(year_group_id) => setUserForm({ ...userForm, year_group_id })}
                disabled={!userForm.institution_id}
                options={yearGroupOptions}
              />
            </div>
          ) : null}
        </div>
        <div className="mt-6 flex w-full items-center justify-end gap-3">
          <button
            type="button"
            onClick={closeUserModal}
            className="flex justify-center rounded-lg bg-white px-4 py-2.5 text-sm font-medium text-gray-700 ring-1 ring-gray-300 ring-inset hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-400 dark:ring-gray-700 dark:hover:bg-white/[0.03]"
          >
            Close
          </button>
          <button
            type="submit"
            disabled={userSubmitting}
            className="flex justify-center rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white shadow-theme-xs hover:bg-brand-600 disabled:opacity-60"
          >
            {userSubmitting ? "Saving..." : editingUser ? "Save Changes" : "Create User"}
          </button>
        </div>
      </form>
    </Modal>
  );

  return (
    <div className="container mx-auto px-4 pb-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Breadcrumb
          className="mb-0"
          items={[
            { label: "Home", href: "/dashboard" },
            { label: "Admin", href: "/admin" },
            { label: "User Management" },
          ]}
        />
        <Button
          onClick={() => {
            resetUserForm();
            setIsUserDialogOpen(true);
          }}
        >
          Create User
        </Button>
      </div>

      <header className="mb-8 text-center">
        <h1 className="text-3xl font-bold tracking-tight text-primary md:text-4xl lg:text-5xl">User Management</h1>
        <p className="mt-4 text-xl text-muted-foreground">Create, edit, and manage user accounts.</p>
        <div className="mx-auto mt-6 grid w-full max-w-3xl grid-cols-1 gap-3 text-start sm:grid-cols-3">
          <input
            type="search"
            value={emailSearch}
            onChange={(e) => setEmailSearch(e.target.value)}
            placeholder="Search by email"
            aria-label="Search by email"
            className={FIELD_INPUT_CLASS}
          />
          <Select value={roleFilter} onChange={setRoleFilter} options={ROLE_OPTIONS} />
          <Select value={yearFilter} onChange={setYearFilter} options={yearFilterOptions} />
        </div>
      </header>

      {error && <div className="mb-6 rounded-md bg-destructive/10 p-4 text-destructive">{error}</div>}

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
        <div className="max-w-full overflow-x-auto">
          <div className="min-w-[720px]">
            <Table>
              <TableHeader className="border-b border-gray-100 dark:border-white/[0.05]">
                <TableRow>
                  <SortHeader label="Email" column="email" sort={sort} onSort={toggle} />
                  <SortHeader label="Role" column="role" sort={sort} onSort={toggle} />
                  <SortHeader label="Institution" column="institution" sort={sort} onSort={toggle} />
                  <SortHeader label="Year" column="year" sort={sort} onSort={toggle} />
                  <SortHeader label="Created" column="created" sort={sort} onSort={toggle} />
                  <TableCell isHeader className="px-5 py-3 text-end text-theme-xs font-medium text-gray-500 dark:text-gray-400">
                    Actions
                  </TableCell>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="px-5 py-8 text-center text-theme-sm text-gray-500 dark:text-gray-400">
                      Loading users...
                    </TableCell>
                  </TableRow>
                ) : sortedUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="px-5 py-8 text-center text-theme-sm text-gray-500 dark:text-gray-400">
                      No users match these filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedUsers.map((user) => (
                    <TableRow key={user.id} className="hover:bg-brand-50 dark:hover:bg-white/[0.03]">
                      <TableCell className="px-5 py-4 text-start text-theme-sm font-medium text-gray-800 sm:px-6 dark:text-white/90">
                        {user.email}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-start text-theme-sm text-gray-500 dark:text-gray-400">
                        <Badge variant={roleBadgeVariant(user.role)} className="capitalize">
                          {user.role}
                        </Badge>
                      </TableCell>
                      <TableCell className="px-4 py-3 text-start text-theme-sm text-gray-500 dark:text-gray-400">
                        {user.institutions?.name || "—"}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-start text-theme-sm text-gray-500 dark:text-gray-400">
                        {user.year_groups?.name || "—"}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-start text-theme-sm text-gray-500 dark:text-gray-400">
                        {new Date(user.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-end text-theme-sm text-gray-500 dark:text-gray-400">
                        <div className="flex items-center justify-end gap-2">
                          <Button variant="ghost" size="sm" onClick={() => openEditUser(user)}>
                            Edit
                          </Button>
                          {userRole === "admin" && (
                            <Button variant="destructive" size="sm" onClick={() => handleDeleteUser(user.user_id)}>
                              Delete
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
      {userDialog}
    </div>
  );
}
