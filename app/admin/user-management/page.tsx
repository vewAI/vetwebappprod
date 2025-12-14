"use client";

import React, { useEffect, useState } from "react";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/features/auth/services/authService";
import { getAccessToken } from "@/lib/auth-headers";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { AdminTour } from "@/components/admin/AdminTour";
import { HelpTip } from "@/components/ui/help-tip";

type Institution = {
  id: string;
  name: string;
  created_at: string;
};

type UserProfile = {
  id: string;
  user_id: string;
  email: string;
  role: string;
  created_at: string;
  institution_id?: string | null;
  institutions?: { name: string } | null;
};

export default function UserManagementPage() {
  const { role: userRole } = useAuth();
  const [activeTab, setActiveTab] = useState<"users" | "institutions">("users");
  
  // Data
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // User Form State
  const [isUserDialogOpen, setIsUserDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [userForm, setUserForm] = useState({
    email: "",
    password: "",
    fullName: "",
    role: "student",
    institution_id: "",
  });
  const [userSubmitting, setUserSubmitting] = useState(false);

  // Institution Form State
  const [isInstDialogOpen, setIsInstDialogOpen] = useState(false);
  const [instName, setInstName] = useState("");
  const [instSubmitting, setInstSubmitting] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const token = await getAccessToken();
      const headers = { Authorization: `Bearer ${token}` };

      const [usersRes, instRes] = await Promise.all([
        axios.get<{ users: UserProfile[] }>("/api/admin/users", { headers }).catch(() => ({ data: { users: [] } })),
        axios.get<{ institutions: Institution[] }>("/api/admin/institutions", { headers }).catch(() => ({ data: { institutions: [] } }))
      ]);

      setUsers(usersRes.data.users || []);
      setInstitutions(instRes.data.institutions || []);
    } catch (err: unknown) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const error = err as any;
      setError(error.response?.data?.error || error.message);
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
      
      const payload = {
        email: userForm.email,
        password: userForm.password, // Only sent on create or if changed
        fullName: userForm.fullName,
        role: userForm.role,
        institution_id: userForm.institution_id || null,
      };

      if (editingUser) {
        await axios.put("/api/admin/users", { ...payload, userId: editingUser.user_id }, { headers });
      } else {
        await axios.post("/api/admin/users", payload, { headers });
      }

      setIsUserDialogOpen(false);
      resetUserForm();
      await fetchData();
    } catch (err: unknown) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const error = err as any;
      alert(error.response?.data?.error || error.message);
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const error = err as any;
      alert(error.response?.data?.error || error.message);
    }
  };

  const handleInstSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setInstSubmitting(true);
      const token = await getAccessToken();
      await axios.post("/api/admin/institutions", { name: instName }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setIsInstDialogOpen(false);
      setInstName("");
      await fetchData();
    } catch (err: unknown) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const error = err as any;
      alert(error.response?.data?.error || error.message);
    } finally {
      setInstSubmitting(false);
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
    });
  };

  const openEditUser = (user: UserProfile) => {
    setEditingUser(user);
    setUserForm({
      email: user.email,
      password: "", // Don't fill password
      fullName: "", // We don't get full name back easily in list, maybe skip or fetch
      role: user.role,
      institution_id: user.institution_id || "",
    });
    setIsUserDialogOpen(true);
  };

  const tourSteps = [
    { element: '#management-title', popover: { title: 'User & Institution Management', description: 'Manage users and their institution assignments.' } },
    { element: '#tab-users', popover: { title: 'Users Tab', description: 'View and manage individual user accounts.' } },
    { element: '#tab-institutions', popover: { title: 'Institutions Tab', description: 'Manage the list of institutions (Universities, Clinics).' } },
    { element: '#btn-create-user', popover: { title: 'Create User', description: 'Add a new user to the system.' } },
  ];

  if (loading) return <div className="p-8">Loading...</div>;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h1 id="management-title" className="text-3xl font-bold">Management</h1>
          <HelpTip content="Central hub for managing users and institutions." />
        </div>
        <div className="flex items-center gap-2">
          <AdminTour steps={tourSteps} tourId="user-management" />
          <div className="flex gap-2">
            <Button 
              id="tab-users"
              variant={activeTab === "users" ? "default" : "outline"} 
              onClick={() => setActiveTab("users")}
            >
              Users
            </Button>
            <Button 
              id="tab-institutions"
              variant={activeTab === "institutions" ? "default" : "outline"} 
              onClick={() => setActiveTab("institutions")}
            >
              Institutions
            </Button>
          </div>
        </div>
      </div>

      {error && <div className="bg-destructive/10 text-destructive p-4 rounded-md">{error}</div>}

      {activeTab === "users" && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Users</CardTitle>
            <Dialog open={isUserDialogOpen} onOpenChange={(open) => {
              setIsUserDialogOpen(open);
              if (!open) resetUserForm();
            }}>
              <DialogTrigger asChild>
                <Button id="btn-create-user">Create User</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editingUser ? "Edit User" : "Create New User"}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleUserSubmit} className="space-y-4">
                  <div>
                    <Label>Email</Label>
                    <Input 
                      value={userForm.email} 
                      onChange={e => setUserForm({...userForm, email: e.target.value})}
                      required
                      type="email"
                    />
                  </div>
                  <div>
                    <Label>Password {editingUser && "(Leave blank to keep current)"}</Label>
                    <Input 
                      value={userForm.password} 
                      onChange={e => setUserForm({...userForm, password: e.target.value})}
                      required={!editingUser}
                      type="password"
                    />
                  </div>
                  <div>
                    <Label>Full Name</Label>
                    <Input 
                      value={userForm.fullName} 
                      onChange={e => setUserForm({...userForm, fullName: e.target.value})}
                      placeholder="Optional"
                    />
                  </div>
                  <div>
                    <Label>Role</Label>
                    <select 
                      className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      value={userForm.role}
                      onChange={e => setUserForm({...userForm, role: e.target.value})}
                      disabled={userRole === "professor" && userForm.role !== "student"} // Professors can only manage students
                    >
                      <option value="student">Student</option>
                      <option value="professor">Professor</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                  <div>
                    <Label>Institution</Label>
                    <select 
                      className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      value={userForm.institution_id}
                      onChange={e => setUserForm({...userForm, institution_id: e.target.value})}
                    >
                      <option value="">-- None --</option>
                      {institutions.map(inst => (
                        <option key={inst.id} value={inst.id}>{inst.name}</option>
                      ))}
                    </select>
                  </div>
                  <Button type="submit" disabled={userSubmitting} className="w-full">
                    {userSubmitting ? "Saving..." : (editingUser ? "Update User" : "Create User")}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <table className="w-full text-sm text-left">
                <thead className="bg-muted/50 text-muted-foreground">
                  <tr>
                    <th className="p-3 font-medium">Email</th>
                    <th className="p-3 font-medium">Role</th>
                    <th className="p-3 font-medium">Institution</th>
                    <th className="p-3 font-medium">Created</th>
                    <th className="p-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(user => (
                    <tr key={user.id} className="border-t hover:bg-muted/50">
                      <td className="p-3">{user.email}</td>
                      <td className="p-3">
                        <Badge variant={user.role === "admin" ? "destructive" : user.role === "professor" ? "default" : "secondary"}>
                          {user.role}
                        </Badge>
                      </td>
                      <td className="p-3">{user.institutions?.name || "-"}</td>
                      <td className="p-3">{new Date(user.created_at).toLocaleDateString()}</td>
                      <td className="p-3 text-right space-x-2">
                        <Button variant="ghost" size="sm" onClick={() => openEditUser(user)}>Edit</Button>
                        {userRole === "admin" && (
                          <Button variant="destructive" size="sm" onClick={() => handleDeleteUser(user.user_id)}>Delete</Button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {users.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-muted-foreground">No users found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === "institutions" && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Institutions</CardTitle>
            {userRole === "admin" && (
              <Dialog open={isInstDialogOpen} onOpenChange={setIsInstDialogOpen}>
                <DialogTrigger asChild>
                  <Button>Create Institution</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create Institution</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleInstSubmit} className="space-y-4">
                    <div>
                      <Label>Name</Label>
                      <Input 
                        value={instName} 
                        onChange={e => setInstName(e.target.value)}
                        required
                      />
                    </div>
                    <Button type="submit" disabled={instSubmitting} className="w-full">
                      {instSubmitting ? "Creating..." : "Create"}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            )}
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <table className="w-full text-sm text-left">
                <thead className="bg-muted/50 text-muted-foreground">
                  <tr>
                    <th className="p-3 font-medium">Name</th>
                    <th className="p-3 font-medium">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {institutions.map(inst => (
                    <tr key={inst.id} className="border-t hover:bg-muted/50">
                      <td className="p-3 font-medium">{inst.name}</td>
                      <td className="p-3">{new Date(inst.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                  {institutions.length === 0 && (
                    <tr>
                      <td colSpan={2} className="p-8 text-center text-muted-foreground">No institutions found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
