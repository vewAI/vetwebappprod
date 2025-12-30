import { useState, useEffect, useMemo } from "react";
import { Loader2, Trash2, FileText, RefreshCw, AlertTriangle, ChevronDown, ChevronRight, Database, FileDigit } from "lucide-react";
import { buildAuthHeaders } from "@/lib/auth-headers";

interface CaseKnowledgeItem {
    id: string;
    content: string;
    metadata: { source?: string; page?: number; source_type?: string };
    created_at: string;
    file_path?: string;
}

interface Props {
    caseId: string;
}

export function CaseRagManager({ caseId }: Props) {
    const [items, setItems] = useState<CaseKnowledgeItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
    const [error, setError] = useState<string | null>(null);
    const [filterSource, setFilterSource] = useState<string>("all");
    const [showDebug, setShowDebug] = useState(false);

    const fetchKnowledge = async () => {
        setLoading(true);
        setError(null);
        try {
            const headers = await buildAuthHeaders();
            const res = await fetch(`/api/cases/${caseId}/knowledge`, { headers });
            if (!res.ok) {
                const json = await res.json().catch(() => ({}));
                const msg = json.error || (res.status === 401 || res.status === 403 ? "Unauthorized to access knowledge audit." : "Failed to fetch knowledge");
                throw new Error(msg);
            }
            const json = await res.json();
            setItems(json.data || []);
            setSelectedIds(new Set());
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchKnowledge();
    }, [caseId]);

    const handleDeleteSelected = async () => {
        if (selectedIds.size === 0) return;
        if (!confirm(`Are you sure you want to delete ${selectedIds.size} chunks?`)) return;

        setDeleting(true);
        try {
            const headers = await buildAuthHeaders({ "Content-Type": "application/json" });
            const res = await fetch(`/api/cases/${caseId}/knowledge`, {
                method: "DELETE",
                headers,
                body: JSON.stringify({ ids: Array.from(selectedIds) }),
            });
            if (!res.ok) throw new Error("Failed to delete chunks");
            await fetchKnowledge();
        } catch (err: any) {
            alert(err.message);
        } finally {
            setDeleting(false);
        }
    };

    const handleDeleteSource = async (source: string) => {
        if (!confirm(`Are you sure you want to EXCLUDE all data from "${source}"? This will remove all extracted knowledge chunks for this reference.`)) return;

        setDeleting(true);
        try {
            const headers = await buildAuthHeaders({ "Content-Type": "application/json" });
            const res = await fetch(`/api/cases/${caseId}/knowledge`, {
                method: "DELETE",
                headers,
                body: JSON.stringify({ source }),
            });
            if (!res.ok) throw new Error("Failed to exclude source");
            await fetchKnowledge();
        } catch (err: any) {
            alert(err.message);
        } finally {
            setDeleting(false);
        }
    };

    const toggleSelect = (id: string) => {
        const next = new Set(selectedIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedIds(next);
    };

    const toggleExpand = (id: string) => {
        const next = new Set(expandedIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setExpandedIds(next);
    }

    const sources = useMemo(() => {
        const map: Record<string, { type: string; count: number }> = {};
        items.forEach(item => {
            const s = item.metadata?.source || "Synthetic/Internal";
            if (!map[s]) {
                const isDoc = item.metadata?.source && item.metadata.source.toLowerCase().includes(".pdf");
                map[s] = { type: isDoc ? "PDF" : "Database", count: 0 };
            }
            map[s].count++;
        });
        return map;
    }, [items]);

    const filteredItems = useMemo(() => {
        if (filterSource === "all") return items;
        return items.filter(i => (i.metadata?.source || "Synthetic/Internal") === filterSource);
    }, [items, filterSource]);

    if (loading && items.length === 0) {
        return (
            <div className="p-10 flex flex-col items-center justify-center text-slate-500 gap-4">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                <p className="text-sm font-medium">Fetching RAG Knowledge Base...</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Header & Stats */}
            <div className="flex items-center justify-between bg-slate-50 p-4 rounded-t-lg border border-b-0">
                <div className="flex items-center gap-3">
                    <div className="bg-indigo-100 p-2 rounded-lg">
                        <FileText className="w-5 h-5 text-indigo-600" />
                    </div>
                    <div>
                        <h3 className="font-semibold text-slate-900">RAG Audit Report</h3>
                        <p className="text-xs text-slate-500">Source breakdown & knowledge verification</p>
                        <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded font-mono">ID: {caseId}</span>
                        </div>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={fetchKnowledge}
                        disabled={loading}
                        className="p-2 text-slate-500 hover:bg-slate-200 rounded-lg transition-colors border bg-white"
                        title="Refresh Knowledge Base"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                    {selectedIds.size > 0 && (
                        <button
                            onClick={handleDeleteSelected}
                            disabled={deleting}
                            className="flex items-center gap-1 px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium shadow-sm transition-colors"
                        >
                            <Trash2 className="w-4 h-4" />
                            Delete Selected ({selectedIds.size})
                        </button>
                    )}
                </div>
            </div>

            {/* Source Inventory */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 px-1">
                <div
                    onClick={() => setFilterSource("all")}
                    className={`cursor-pointer p-3 rounded-lg border-2 transition-all ${filterSource === "all" ? "border-indigo-500 bg-indigo-50" : "border-slate-100 hove:border-slate-200 bg-white"}`}
                >
                    <div className="flex justify-between items-start">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">All Chunks</span>
                        <div className="text-xl font-bold text-slate-900">{items.length}</div>
                    </div>
                </div>
                {Object.entries(sources).map(([name, data]) => (
                    <div
                        key={name}
                        onClick={() => setFilterSource(name)}
                        className={`group relative cursor-pointer p-3 rounded-lg border-2 transition-all ${filterSource === name ? "border-indigo-500 bg-indigo-50" : "border-slate-100 hover:border-slate-200 bg-white"}`}
                    >
                        <div className="flex justify-between items-start mb-2">
                            <div className="flex items-center gap-2">
                                {data.type === "PDF" ? <FileDigit className="w-4 h-4 text-orange-500" /> : <Database className="w-4 h-4 text-blue-500" />}
                                <span className="text-xs font-bold text-slate-700 truncate max-w-[120px]" title={name}>{name}</span>
                            </div>
                            <div className="text-xl font-bold text-slate-900">{data.count}</div>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className={`text-[10px] px-1.5 py-0.5 rounded ${data.type === "PDF" ? "bg-orange-100 text-orange-700" : "bg-blue-100 text-blue-700"}`}>
                                {data.type}
                            </span>
                            <button
                                onClick={(e) => { e.stopPropagation(); handleDeleteSource(name); }}
                                className="opacity-0 group-hover:opacity-100 p-1 text-red-500 hover:bg-red-50 rounded transition-all"
                                title="Exclude this source entirely"
                            >
                                <Trash2 className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {error && (
                <div className="p-3 bg-red-50 text-red-700 text-sm rounded-lg flex items-center gap-2 mx-1 border border-red-200 animate-pulse">
                    <AlertTriangle className="w-4 h-4" />
                    <span className="font-medium">{error}</span>
                </div>
            )}

            {/* Knowledge Table */}
            <div className="border rounded-lg bg-white overflow-hidden shadow-sm">
                <div className="overflow-x-auto max-h-[500px]">
                    <table className="w-full text-sm text-left border-collapse">
                        <thead className="text-xs text-slate-500 uppercase bg-slate-50/80 backdrop-blur sticky top-0 z-10 border-b">
                            <tr>
                                <th className="p-3 w-8">
                                    <input
                                        type="checkbox"
                                        checked={filteredItems.length > 0 && Array.from(selectedIds).length === filteredItems.length}
                                        onChange={() => {
                                            if (selectedIds.size === filteredItems.length) setSelectedIds(new Set());
                                            else setSelectedIds(new Set(filteredItems.map(i => i.id)));
                                        }}
                                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                    />
                                </th>
                                <th className="p-3">Knowledge Fragment</th>
                                <th className="p-3 w-48">Source Context</th>
                                <th className="p-3 w-32">Added</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredItems.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="p-10 text-center text-slate-400 italic">
                                        No items matching the selected source filter.
                                    </td>
                                </tr>
                            ) : (
                                filteredItems.map((item) => (
                                    <tr key={item.id} className={`group border-l-4 transition-colors ${selectedIds.has(item.id) ? "bg-indigo-50/30 border-l-indigo-500" : "hover:bg-slate-50/50 border-l-transparent"}`}>
                                        <td className="p-3 align-top">
                                            <input
                                                type="checkbox"
                                                checked={selectedIds.has(item.id)}
                                                onChange={() => toggleSelect(item.id)}
                                                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                            />
                                        </td>
                                        <td className="p-3">
                                            <div
                                                className={`cursor-pointer text-xs font-mono text-slate-700 leading-relaxed ${expandedIds.has(item.id) ? "" : "line-clamp-3"}`}
                                                onClick={() => toggleExpand(item.id)}
                                            >
                                                {item.content}
                                            </div>
                                            <button
                                                onClick={() => toggleExpand(item.id)}
                                                className="mt-1 text-[10px] text-indigo-500 hover:text-indigo-700 font-medium flex items-center gap-0.5"
                                            >
                                                {expandedIds.has(item.id) ? (
                                                    <><ChevronDown className="w-3 h-3" /> Show less</>
                                                ) : (
                                                    <><ChevronRight className="w-3 h-3" /> Read full context</>
                                                )}
                                            </button>
                                        </td>
                                        <td className="p-3 align-top">
                                            <div className="flex flex-col gap-1">
                                                <div className="flex items-center gap-1.5 min-w-0">
                                                    <span className={`w-2 h-2 rounded-full shrink-0 ${item.metadata?.source?.toLowerCase().includes(".pdf") ? "bg-orange-400" : "bg-blue-400"}`} />
                                                    <span className="font-medium text-slate-800 text-xs truncate" title={item.metadata?.source}>
                                                        {item.metadata?.source || "Synthetic/Internal"}
                                                    </span>
                                                </div>
                                                {item.metadata?.page && (
                                                    <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded self-start">
                                                        Page {item.metadata.page}
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="p-3 align-top text-[10px] text-slate-400 whitespace-nowrap">
                                            {new Date(item.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                                            <div className="text-[9px] opacity-70">
                                                {new Date(item.created_at).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
            <p className="text-[10px] text-slate-400 px-1">
                * Synthetic data is generated from the core case fields in the database. Deleting these won't affect the original case but will prevent the AI from seeing that specific summarized context.
            </p>
        </div>
    );
}
