import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { FileText, Plus, Lock, CheckCircle2, DollarSign, Calculator, ArrowRight } from 'lucide-react';

export function PayrollScreen() {
  const { token, user } = useAuth();
  const [payrolls, setPayrolls] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [targetMonth, setTargetMonth] = useState('2026-10');
  const [generating, setGenerating] = useState(false);

  const isAdmin = user?.role === 'admin';

  const fetchPayrolls = async () => {
    try {
      const res = await fetch('/api/payroll', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setPayrolls(data);
      }
    } catch (err) {
      console.error('Error fetching payrolls:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayrolls();
  }, []);

  const handleGenerateDraft = async () => {
    setGenerating(true);
    try {
      const res = await fetch('/api/payroll/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ month: targetMonth })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to generate payroll.');
      }
      await fetchPayrolls();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setGenerating(false);
    }
  };

  const handleFinalize = async (id: string) => {
    const confirm = window.confirm(
      'Are you sure you want to finalize this payroll run? Once finalized, payroll records become locked and immutable.'
    );
    if (!confirm) return;

    try {
      const res = await fetch(`/api/payroll/${id}/finalize`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        await fetchPayrolls();
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="glass-panel rounded-3xl p-6 border border-white/10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-white flex items-center space-x-2.5">
            <Calculator className="w-6 h-6 text-[#00f2fe]" />
            <span>AUTOMATED PAYROLL & TAX CALCULATIONS</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1 font-mono">
            SAYLANI FORMULA: GROSS = 1.5× BASIC (40% HRA + 10% MEDICAL) // PAKISTAN TAX SLABS
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <input
            type="month"
            value={targetMonth}
            onChange={(e) => setTargetMonth(e.target.value)}
            className="px-3 py-2 text-xs cyber-input font-mono"
          />
          <button
            type="button"
            disabled={generating}
            onClick={handleGenerateDraft}
            className="glow-btn-cyan px-4 py-2 rounded-xl text-xs uppercase tracking-wider font-bold transition-all cursor-pointer disabled:opacity-50 flex items-center space-x-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>{generating ? 'CALCULATING...' : 'GENERATE DRAFT'}</span>
          </button>
        </div>
      </div>

      <div className="space-y-6">
        {payrolls.length === 0 ? (
          <div className="glass-panel rounded-3xl p-12 text-center text-slate-400 border border-white/10 font-mono text-xs">
            {loading ? 'Retrieving payroll database records...' : 'No payroll runs generated yet. Select month and click "Generate Draft".'}
          </div>
        ) : (
          payrolls.map((p) => (
            <div key={p.id} className="glass-panel rounded-3xl p-6 border border-white/10 space-y-4 shadow-xl">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-white/10 pb-4">
                <div>
                  <div className="flex items-center space-x-2.5">
                    <h3 className="font-extrabold text-white text-base tracking-wide">
                      Payroll Period: <span className="text-[#00f2fe] font-mono">{p.month}</span>
                    </h3>
                    <span
                      className={`text-[10px] font-mono uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${
                        p.status === 'finalized'
                          ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                          : 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                      }`}
                    >
                      {p.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 font-mono mt-1">
                    Gross Total: <strong className="text-white">PKR {p.totalGross.toLocaleString()}</strong> | 
                    Tax Total: <strong className="text-rose-400">PKR {p.totalTax.toLocaleString()}</strong> | 
                    Net Total: <strong className="text-[#00f2fe]">PKR {p.totalNet.toLocaleString()}</strong>
                  </p>
                </div>

                {isAdmin && p.status === 'draft' && (
                  <button
                    type="button"
                    onClick={() => handleFinalize(p.id)}
                    className="glow-btn-magenta px-4 py-2 rounded-xl text-xs uppercase font-bold tracking-wider transition-all cursor-pointer flex items-center space-x-1.5 self-start sm:self-auto"
                  >
                    <Lock className="w-3.5 h-3.5 text-white" />
                    <span>FINALIZE & LOCK PAYROLL</span>
                  </button>
                )}
              </div>

              {/* Items Table */}
              <div className="overflow-x-auto rounded-2xl border border-white/10 bg-[#070918]/60">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-[#0e122b] text-slate-400 text-[10px] uppercase tracking-wider border-b border-white/10">
                    <tr>
                      <th className="py-3 px-3">Emp Code</th>
                      <th className="py-3 px-3">Employee Name</th>
                      <th className="py-3 px-3">Department</th>
                      <th className="py-3 px-3">Basic (PKR)</th>
                      <th className="py-3 px-3">Gross (1.5x)</th>
                      <th className="py-3 px-3">Monthly Tax</th>
                      <th className="py-3 px-3 font-extrabold text-white">Net Payout</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-[11px]">
                    {p.items?.map((item: any) => (
                      <tr key={item.employeeId} className="hover:bg-white/5 transition-colors">
                        <td className="py-2.5 px-3 font-bold text-cyan-300">{item.employeeCode}</td>
                        <td className="py-2.5 px-3 font-semibold text-white font-sans">{item.employeeName}</td>
                        <td className="py-2.5 px-3 text-slate-400">{item.department}</td>
                        <td className="py-2.5 px-3 text-slate-300">{item.basicSalary.toLocaleString()}</td>
                        <td className="py-2.5 px-3 text-purple-300 font-bold">
                          {item.grossSalary.toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3 text-rose-400">
                          {item.monthlyTax.toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3 font-extrabold text-white">
                          PKR {item.netSalary.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
