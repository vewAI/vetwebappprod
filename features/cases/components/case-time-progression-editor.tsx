"use client";

import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trash2, Plus, Clock, ArrowDown } from "lucide-react";
import type { CaseTimepoint, CreateCaseTimepointDTO } from "../models/caseTimepoint";
import axios from "axios";
import { useAuth } from "@/features/auth/services/authService";

type TimeProgressionEditorProps = {
  caseId: string;
  readOnly?: boolean;
};

export function TimeProgressionEditor({ caseId, readOnly = false }: TimeProgressionEditorProps) {
  const { session } = useAuth();
  const [timepoints, setTimepoints] = useState<CaseTimepoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (caseId) {
      fetchTimepoints();
    }
  }, [caseId]);

  const fetchTimepoints = async () => {
    setLoading(true);
    try {
      const token = session?.access_token;
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await axios.get(`/api/cases/${caseId}/timepoints`, { headers });
      // API returns the array directly
      setTimepoints(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Failed to fetch timepoints", err);
      setError("Could not load time progression.");
    } finally {
      setLoading(false);
    }
  };

  const handleAddTimepoint = async () => {
    if (readOnly) return;
    const newTimepoint: CreateCaseTimepointDTO = {
      case_id: caseId,
      sequence_index: timepoints.length,
      label: `Day ${timepoints.length + 2}`, // Default to Day 2, 3...
      summary: "",
      available_after_hours: 24,
      persona_role_key: "owner",
      stage_prompt: "",
    };

    try {
      const token = session?.access_token;
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await axios.post<CaseTimepoint>(`/api/cases/${caseId}/timepoints`, newTimepoint, { headers });
      // API returns the created object directly
      setTimepoints([...timepoints, res.data]);
    } catch (err) {
      console.error("Failed to create timepoint", err);
      alert("Failed to add timepoint");
    }
  };

  const handleUpdate = async (id: string, updates: Partial<CaseTimepoint>) => {
    if (readOnly) return;
    // Optimistic update
    const original = timepoints;
    setTimepoints(prev => prev.map(tp => tp.id === id ? { ...tp, ...updates } : tp));

    try {
      const token = session?.access_token;
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      await axios.patch(`/api/cases/${caseId}/timepoints/${id}`, updates, { headers });
    } catch (err) {
      console.error("Failed to update timepoint", err);
      setTimepoints(original); // Revert
    }
  };

  const handleDelete = async (id: string) => {
    if (readOnly || !confirm("Are you sure you want to delete this timepoint?")) return;
    
    try {
      const token = session?.access_token;
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      await axios.delete(`/api/cases/${caseId}/timepoints/${id}`, { headers });
      setTimepoints(prev => prev.filter(tp => tp.id !== id));
    } catch (err) {
      console.error("Failed to delete timepoint", err);
      alert("Failed to delete timepoint");
    }
  };

  if (loading && timepoints.length === 0) return <div className="text-sm text-muted-foreground">Loading timeline...</div>;
  if (error) return <div className="text-sm text-red-500">{error}</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Time Progression</h3>
        {!readOnly && (
          <Button onClick={handleAddTimepoint} size="sm" variant="outline">
            <Plus className="h-4 w-4 mr-2" />
            Add Timepoint
          </Button>
        )}
      </div>

      <div className="relative border-l-2 border-muted ml-4 space-y-8 pl-6 py-2">
        {/* Initial State (Day 1) */}
        <div className="relative">
          <div className="absolute -left-[33px] top-0 h-4 w-4 rounded-full bg-primary" />
          <div className="text-sm font-semibold">Start (Day 1)</div>
          <div className="text-xs text-muted-foreground">Initial consultation</div>
        </div>

        {timepoints.map((tp, idx) => (
          <div key={tp.id} className="relative">
             <div className="absolute -left-[33px] top-0 h-4 w-4 rounded-full bg-muted-foreground" />
             <Card>
               <CardHeader className="pb-2">
                 <div className="flex items-center justify-between">
                   <CardTitle className="text-base">
                     {readOnly ? (
                       tp.label
                     ) : (
                       <Input 
                         value={tp.label} 
                         onChange={(e) => handleUpdate(tp.id, { label: e.target.value })}
                         className="h-7 w-32 font-bold"
                       />
                     )}
                   </CardTitle>
                   {!readOnly && (
                     <Button variant="ghost" size="icon" onClick={() => handleDelete(tp.id)}>
                       <Trash2 className="h-4 w-4 text-red-500" />
                     </Button>
                   )}
                 </div>
               </CardHeader>
               <CardContent className="space-y-3 text-sm">
                 <div className="grid grid-cols-2 gap-4">
                   <div>
                     <Label className="text-xs">Available After (Hours)</Label>
                     <div className="flex items-center gap-2">
                       <Clock className="h-3 w-3 text-muted-foreground" />
                       <Input 
                         type="number" 
                         value={tp.available_after_hours || 0}
                         onChange={(e) => handleUpdate(tp.id, { available_after_hours: parseInt(e.target.value) || 0 })}
                         disabled={readOnly}
                         className="h-8"
                       />
                     </div>
                   </div>
                   <div>
                     <Label className="text-xs">Active Persona</Label>
                     <select 
                       className="flex h-8 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                       value={tp.persona_role_key || "owner"}
                       onChange={(e) => handleUpdate(tp.id, { persona_role_key: e.target.value })}
                       disabled={readOnly}
                     >
                       <option value="owner">Owner</option>
                       <option value="veterinary-nurse">Nurse</option>
                     </select>
                   </div>
                 </div>
                 
                 <div>
                   <Label className="text-xs">Summary (Learner Facing)</Label>
                   <Input 
                     value={tp.summary || ""}
                     onChange={(e) => handleUpdate(tp.id, { summary: e.target.value })}
                     placeholder="e.g. The owner calls back with an update..."
                     disabled={readOnly}
                   />
                 </div>

                 <div>
                   <Label className="text-xs">Stage Prompt / Update</Label>
                   <Textarea 
                     value={tp.stage_prompt || ""}
                     onChange={(e) => handleUpdate(tp.id, { stage_prompt: e.target.value })}
                     placeholder="Instructions for the persona at this timepoint..."
                     disabled={readOnly}
                     rows={3}
                   />
                 </div>
               </CardContent>
             </Card>
          </div>
        ))}
      </div>
    </div>
  );
}
