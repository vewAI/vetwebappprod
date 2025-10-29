"use client";

import React from "react";
import { useAuth } from "@/features/auth/services/authService";

export default function DebugAuthPage() {
  const { user, session, loading, role, isAdmin, profileLoading } = useAuth();

  return (
    <div className="max-w-3xl mx-auto p-8">
      <h1 className="text-2xl font-bold mb-4">Auth Debug</h1>
      <div className="mb-4">
        <strong>loading:</strong> {String(loading)}
      </div>
      <div className="mb-4">
        <strong>profileLoading:</strong> {String(profileLoading)}
      </div>
      <div className="mb-4">
        <strong>role:</strong> {String(role)}
      </div>
      <div className="mb-4">
        <strong>isAdmin:</strong> {String(isAdmin)}
      </div>
      <div className="mb-4">
        <strong>user:</strong>
        <pre className="whitespace-pre-wrap p-2 bg-gray-100 rounded mt-2">
          {JSON.stringify(user, null, 2)}
        </pre>
      </div>
      <div className="mb-4">
        <strong>session:</strong>
        <pre className="whitespace-pre-wrap p-2 bg-gray-100 rounded mt-2">
          {JSON.stringify(session, null, 2)}
        </pre>
      </div>
    </div>
  );
}
