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
        return <AlertCircle className="w-4 h-4 text-red-400" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-yellow-400" />;
      case 'info':
        return <Info className="w-4 h-4 text-blue-400" />;
      default:
        return <Info className="w-4 h-4 text-gray-400" />;
    }
  };

  const getSeverityBg = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-500/10 border-red-500/50';
      case 'warning':
        return 'bg-yellow-500/10 border-yellow-500/50';
      case 'info':
        return 'bg-blue-500/10 border-blue-500/50';
      default:
        return 'bg-gray-500/10 border-gray-500/50';
    }
  };

  return (
    <div className="glass-lg glow-primary p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-light text-foreground">Active Alarms</h3>
        <span className={`text-sm px-2 py-1 rounded-full font-semibold ${alarms.length > 0 ? 'bg-red-500/20 text-red-400 animate-pulse' : 'bg-accent/20 text-accent'
          }`}>
          {alarms.length}
        </span>
      </div>

      {alarms.length === 0 ? (
        <div className="py-8 text-center">
          <Check className="w-8 h-8 text-green-400 mx-auto mb-2" />
          <p className="text-muted-foreground text-sm">All systems operational</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {alarms.map((alarm) => (
            <div
              key={alarm.id}
              className={`p-3 rounded-lg border transition-all duration-200 ${getSeverityBg(alarm.severity)} ${alarm.acknowledged ? 'opacity-50' : ''
                }`}
            >
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 pt-0.5">{getSeverityIcon(alarm.severity)}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-muted-foreground">{alarm.machineName}</p>
                  <p className="text-sm text-foreground leading-tight mt-1">{alarm.message}</p>
                  <p className="text-xs text-muted-foreground mt-2">
                    {alarm.timestamp.toLocaleTimeString('en-US', {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })}
                  </p>
                </div>
                {alarm.state === 'ACTIVE' && (
                  <button
                    onClick={() => handleAcknowledge(alarm.id)}
                    disabled={actionLoading === alarm.id}
                    className="flex-shrink-0 px-2 py-1 text-xs font-medium rounded transition-all duration-200 bg-muted text-muted-foreground hover:bg-primary hover:text-primary-foreground disabled:opacity-50"
                  >
                    {actionLoading === alarm.id ? '...' : 'ACK'}
                  </button>
                )}
                {alarm.acknowledged && (
                  <span className="flex-shrink-0 px-2 py-1 text-xs font-medium rounded bg-green-500/20 text-green-400 border border-green-500/50">
                    ACK ✓
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
