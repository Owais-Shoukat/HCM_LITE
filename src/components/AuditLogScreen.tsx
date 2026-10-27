import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { ShieldCheck, Search, RefreshCw, Lock, Terminal } from 'lucide-react';
import type { AuditLog } from '../types/index.ts';

export function AuditLogScreen() {
  const { token } = useAuth();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/audit', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setLogs(data);
      }
    } catch (err) {
      console.error('Error fetching audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const filteredLogs = logs.filter((l) => {
    const q = searchQuery.toLowerCase();
    return (
      l.action.toLowerCase().includes(q) ||
      (l.userEmail && l.userEmail.toLowerCase().includes(q)) ||
      l.details.toLowerCase().includes(q) ||
      l.entityType.toLowerCase().includes(q)
    );
  });

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="glass-panel rounded-3xl p-6 border border-white/10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-white flex items-center space-x-2.5">
            <ShieldCheck className="w-6 h-6 text-[#00f2fe]" />
            <span>IMMUTABLE SECURITY AUDIT TRAIL</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1 font-mono">
            APPEND-ONLY LOG // CRYPTOGRAPHIC CHAIN INTEGRITY
          </p>
        </div>

        <button
          type="button"
          onClick={fetchLogs}
          className="glow-btn-purple p-2.5 rounded-xl transition-all cursor-pointer self-start sm:self-auto flex items-center gap-1.5 text-xs font-bold"
          title="Refresh Logs"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span>SYNC AUDIT</span>
        </button>
      </div>

      {/* Main Table Container */}
      <div className="glass-panel rounded-3xl p-6 border border-white/10 space-y-4">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter audit actions, actor emails..."
            className="w-full pl-10 pr-4 py-2 text-xs cyber-input font-mono"
          />
        </div>

        <div className="overflow-x-auto rounded-2xl border border-white/10 bg-[#070918]/60">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#0e122b] text-slate-400 font-mono text-[10px] uppercase tracking-wider border-b border-white/10">
              <tr>
                <th className="py-3.5 px-4">Timestamp (PKT)</th>
                <th className="py-3.5 px-4">Actor</th>
                <th className="py-3.5 px-4">Action</th>
                <th className="py-3.5 px-4">Entity</th>
                <th className="py-3.5 px-4">Audit Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 font-mono text-[11px]">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-slate-400 font-sans">
                    {loading ? 'Decrypting audit log entries...' : 'No audit records match the query.'}
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-white/5 transition-colors">
                    <td className="py-3 px-4 text-slate-400 whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleString('en-PK', { timeZone: 'Asia/Karachi' })}
                    </td>
                    <td className="py-3 px-4 text-white font-medium">
                      {log.userEmail || <span className="text-slate-500">System</span>}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-full text-[10px] uppercase font-bold tracking-wider bg-purple-500/10 text-purple-300 border border-purple-500/30">
                        {log.action}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-cyan-300">{log.entityType}</td>
                    <td className="py-3 px-4 text-slate-300 font-sans max-w-md truncate" title={log.details}>
                      {log.details}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
