import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { FileText, Plus, Lock, CheckCircle2, DollarSign } from 'lucide-react';

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
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center space-x-2">
            <FileText className="w-6 h-6 text-emerald-600" />
            <span>Automated Monthly Payroll Engine</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Official Saylani Formulas: Gross = 1.5× Basic (Basic + 40% HRA + 10% Medical), 5 Progressive Tax Slabs / 12, Deductions.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <input
            type="month"
            value={targetMonth}
            onChange={(e) => setTargetMonth(e.target.value)}
            className="px-3 py-2 text-xs border border-slate-300 rounded-xl outline-none"
          />
          <button
            type="button"
            disabled={generating}
            onClick={handleGenerateDraft}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer disabled:opacity-50 flex items-center space-x-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>{generating ? 'Calculating...' : 'Generate Draft'}</span>
          </button>
        </div>
      </div>

      <div className="space-y-6">
        {payrolls.length === 0 ? (
          <div className="bg-white rounded-3xl p-12 text-center text-slate-400 border border-slate-200">
            No payroll runs generated yet. Select month and click "Generate Draft".
          </div>
        ) : (
          payrolls.map((p) => (
            <div key={p.id} className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-4">
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="font-extrabold text-slate-900 text-base">Payroll Run: {p.month}</h3>
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                        p.status === 'finalized'
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          : 'bg-amber-100 text-amber-800 border border-amber-200'
                      }`}
                    >
                      {p.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 font-mono mt-0.5">
                    Total Gross: PKR {p.totalGross.toLocaleString()} | Total Tax: PKR {p.totalTax.toLocaleString()} | Net: PKR {p.totalNet.toLocaleString()}
                  </p>
                </div>

                {isAdmin && p.status === 'draft' && (
                  <button
                    type="button"
                    onClick={() => handleFinalize(p.id)}
                    className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer flex items-center space-x-1.5 self-start sm:self-auto shadow-sm"
                  >
                    <Lock className="w-3.5 h-3.5 text-amber-400" />
                    <span>Admin Finalization Lock</span>
                  </button>
                )}
              </div>

              {/* Items Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">Emp Code</th>
                      <th className="py-2.5 px-3">Employee Name</th>
                      <th className="py-2.5 px-3">Department</th>
                      <th className="py-2.5 px-3">Basic (PKR)</th>
                      <th className="py-2.5 px-3">Gross (1.5x)</th>
                      <th className="py-2.5 px-3">Monthly Tax</th>
                      <th className="py-2.5 px-3 font-extrabold text-slate-900">Net Pay</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {p.items?.map((item: any) => (
                      <tr key={item.employeeId} className="hover:bg-slate-50/50">
                        <td className="py-2.5 px-3 font-mono font-bold">{item.employeeCode}</td>
                        <td className="py-2.5 px-3 font-semibold text-slate-800">{item.employeeName}</td>
                        <td className="py-2.5 px-3 text-slate-500">{item.department}</td>
                        <td className="py-2.5 px-3 font-mono">{item.basicSalary.toLocaleString()}</td>
                        <td className="py-2.5 px-3 font-mono text-emerald-700 font-bold">
                          {item.grossSalary.toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-rose-600">
                          {item.monthlyTax.toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3 font-mono font-extrabold text-slate-900">
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
