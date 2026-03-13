'use client';

import React, { useState } from 'react';
import { Alarm } from '@/hooks/useRealTimeData';
import { AlertCircle, AlertTriangle, Info, Check } from 'lucide-react';
import { acknowledgeAlarm } from '@/lib/api';

interface AlarmPanelProps {
  alarms: Alarm[];
}

export default function AlarmPanel({ alarms }: AlarmPanelProps) {
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const handleAcknowledge = async (alarmId: string) => {
    setActionLoading(alarmId);
    try {
      await acknowledgeAlarm(alarmId, 'operator');
    } catch (err) {
      console.error('Failed to acknowledge:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <AlertCircle className="w-4 h-4 text-rose-400 drop-shadow-[0_0_5px_rgba(251,113,133,0.8)]" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-yellow-400 drop-shadow-[0_0_5px_rgba(250,204,21,0.8)]" />;
      case 'info':
        return <Info className="w-4 h-4 text-cyan-400 drop-shadow-[0_0_5px_rgba(34,211,238,0.8)]" />;
      default:
        return <Info className="w-4 h-4 text-slate-400" />;
    }
  };

  const getSeverityBg = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-rose-500/10 border-rose-500/30 group-hover:border-rose-500/50';
      case 'warning':
        return 'bg-yellow-500/10 border-yellow-500/30 group-hover:border-yellow-500/50';
      case 'info':
        return 'bg-cyan-500/10 border-cyan-500/30 group-hover:border-cyan-500/50';
      default:
        return 'bg-slate-500/10 border-slate-500/30 group-hover:border-slate-500/50';
    }
  };

  return (
    <div className="relative glass-lg p-6 overflow-hidden border border-white/5 bg-gradient-to-b from-background to-background/50">
      <div className="flex items-center justify-between mb-4 border-b border-white/10 pb-4">
        <div className="flex items-center gap-2">
          <div className={`p-1.5 rounded border ${alarms.length > 0 ? 'bg-rose-500/10 border-rose-500/30' : 'bg-emerald-500/10 border-emerald-500/30'}`}>
            <AlertTriangle className={`w-4 h-4 ${alarms.length > 0 ? 'text-rose-400' : 'text-emerald-400'}`} />
          </div>
          <h3 className="text-sm font-mono font-medium text-white tracking-widest uppercase">System Alerts</h3>
        </div>
        <span className={`text-[10px] px-2 py-0.5 border rounded-sm font-mono tracking-widest uppercase ${alarms.length > 0 ? 'bg-rose-500/20 border-rose-500/50 text-rose-400 animate-pulse' : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'}`}>
          {alarms.length} Active
        </span>
      </div>

      {alarms.length === 0 ? (
        <div className="py-8 text-center bg-black/40 border border-white/5 rounded mt-2">
          <Check className="w-6 h-6 text-emerald-400 mx-auto mb-3 drop-shadow-[0_0_5px_rgba(52,211,153,0.5)]" />
          <p className="text-emerald-500/70 text-[11px] font-mono tracking-widest uppercase">&gt; ALL SYSTEMS NOMINAL</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-96 overflow-y-auto pr-1 mt-4 custom-scrollbar">
          {alarms.map((alarm) => (
            <div
              key={alarm.id}
              className={`relative p-3 rounded border transition-all duration-300 group ${getSeverityBg(alarm.severity)} ${alarm.acknowledged ? 'opacity-50' : ''}`}
            >
              <div className="absolute left-0 top-0 w-1 h-full bg-current opacity-50" />
              <div className="flex items-start gap-3 pl-2">
                <div className="flex-shrink-0 pt-1">{getSeverityIcon(alarm.severity)}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                     <p className="text-[10px] font-mono text-slate-400 uppercase tracking-widest">{alarm.machineName}</p>
                     <p className="text-[10px] font-mono text-slate-500">
                      {alarm.timestamp.toLocaleTimeString('en-US', {
                         hour: '2-digit', minute: '2-digit', second: '2-digit',
                      })}
                     </p>
                  </div>
                  <p className="text-xs font-mono text-white leading-relaxed">{alarm.message}</p>
                </div>
                {alarm.state === 'ACTIVE' && (
                  <button
                    onClick={() => handleAcknowledge(alarm.id)}
                    disabled={actionLoading === alarm.id}
                    className="flex-shrink-0 px-2 py-1.5 text-[10px] font-mono font-bold tracking-widest uppercase rounded border transition-all duration-200 bg-black/40 border-white/20 text-slate-300 hover:bg-white/10 hover:text-white disabled:opacity-50"
                  >
                    {actionLoading === alarm.id ? 'ACK...' : '[ ACK ]'}
                  </button>
                )}
                {alarm.acknowledged && (
                  <span className="flex-shrink-0 px-2 py-1.5 text-[10px] font-mono font-bold tracking-widest uppercase rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                    ACKED ✓
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
