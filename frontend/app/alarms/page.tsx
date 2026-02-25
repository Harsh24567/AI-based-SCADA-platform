'use client';

import React, { useState } from 'react';
import MainLayout from '@/components/MainLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useRealTimeData } from '@/hooks/useRealTimeData';
import { useAuth } from '@/context/AuthContext';
import { AlertCircle, AlertTriangle, Info, Filter, Download, Shield } from 'lucide-react';
import { acknowledgeAlarm as apiAcknowledge, clearAlarm as apiClear, clearAllAlarms } from '@/lib/api';

type SeverityFilter = 'all' | 'critical' | 'warning' | 'info';

function AlarmsContent() {
  const { alarms, loading } = useRealTimeData();
  const { user } = useAuth();
  const [filter, setFilter] = useState<SeverityFilter>('all');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const filteredAlarms = alarms.filter((alarm) => {
    if (filter === 'all') return true;
    return alarm.severity === filter;
  });

  const handleAcknowledge = async (alarmId: string) => {
    setActionLoading(alarmId);
    try {
      await apiAcknowledge(alarmId, user?.username || 'operator');
    } catch (err) {
      console.error('Failed to acknowledge alarm:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleClear = async (alarmId: string) => {
    setActionLoading(alarmId);
    try {
      await apiClear(alarmId);
    } catch (err) {
      console.error('Failed to clear alarm:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleClearAll = async () => {
    setActionLoading('clear-all');
    try {
      await clearAllAlarms();
    } catch (err) {
      console.error('Failed to clear all alarms:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <AlertCircle className="w-5 h-5 text-red-400" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-yellow-400" />;
      case 'info':
        return <Info className="w-5 h-5 text-blue-400" />;
      default:
        return <Info className="w-5 h-5 text-gray-400" />;
    }
  };

  const getSeverityBg = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-500/10 border-red-500/50 hover:border-red-500/70';
      case 'warning':
        return 'bg-yellow-500/10 border-yellow-500/50 hover:border-yellow-500/70';
      case 'info':
        return 'bg-blue-500/10 border-blue-500/50 hover:border-blue-500/70';
      default:
        return 'bg-gray-500/10 border-gray-500/50 hover:border-gray-500/70';
    }
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-full">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-accent"></div>
        </div>
      </MainLayout>
    );
  }

  const criticalCount = alarms.filter((a) => a.severity === 'critical').length;
  const warningCount = alarms.filter((a) => a.severity === 'warning').length;
  const infoCount = alarms.filter((a) => a.severity === 'info').length;

  return (
    <MainLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold text-foreground">Alarm Management</h2>
            <p className="text-muted-foreground mt-1">Track and manage system alerts (ISA-18.2)</p>
          </div>
          <div className="flex gap-2">
            {user?.role === 'ADMIN' && (
              <button
                onClick={handleClearAll}
                disabled={actionLoading === 'clear-all'}
                className="flex items-center gap-2 px-4 py-2 bg-destructive/20 text-destructive border border-destructive/50 rounded-lg hover:bg-destructive/30 transition-colors font-medium text-sm"
              >
                <Shield size={16} />
                {actionLoading === 'clear-all' ? 'Clearing...' : 'Clear All'}
              </button>
            )}
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-card border border-red-500/50 bg-red-500/10 rounded-lg p-4">
            <p className="text-sm text-muted-foreground">Critical</p>
            <p className="text-2xl font-bold text-red-400">{criticalCount}</p>
          </div>
          <div className="bg-card border border-yellow-500/50 bg-yellow-500/10 rounded-lg p-4">
            <p className="text-sm text-muted-foreground">Warnings</p>
            <p className="text-2xl font-bold text-yellow-400">{warningCount}</p>
          </div>
          <div className="bg-card border border-blue-500/50 bg-blue-500/10 rounded-lg p-4">
            <p className="text-sm text-muted-foreground">Info</p>
            <p className="text-2xl font-bold text-blue-400">{infoCount}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          <Filter size={18} className="text-muted-foreground" />
          {(['all', 'critical', 'warning', 'info'] as const).map((sev) => (
            <button
              key={sev}
              onClick={() => setFilter(sev)}
              className={`px-3 py-1 rounded-full text-sm font-medium transition-all ${filter === sev
                  ? 'bg-accent text-accent-foreground'
                  : 'bg-card border border-border text-muted-foreground hover:text-foreground'
                }`}
            >
              {sev.charAt(0).toUpperCase() + sev.slice(1)}
            </button>
          ))}
        </div>

        {/* Alarms List */}
        <div className="space-y-3">
          {filteredAlarms.length === 0 ? (
            <div className="bg-card border border-border rounded-lg p-8 text-center">
              <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-50" />
              <p className="text-muted-foreground">
                {filter === 'all' ? 'No active alarms — all systems operational ✓' : `No ${filter} alarms`}
              </p>
            </div>
          ) : (
            filteredAlarms.map((alarm) => (
              <div
                key={alarm.id}
                className={`p-4 rounded-lg border transition-all duration-200 ${getSeverityBg(alarm.severity)} ${alarm.acknowledged ? 'opacity-60' : ''
                  }`}
              >
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 pt-1">{getSeverityIcon(alarm.severity)}</div>
                  <div className="flex-1">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h4 className="font-semibold text-foreground">{alarm.machineName}</h4>
                        <p className="text-sm text-muted-foreground mt-1">{alarm.message}</p>
                        <div className="flex items-center gap-3 mt-2">
                          <p className="text-xs text-muted-foreground">
                            {alarm.timestamp.toLocaleString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit',
                            })}
                          </p>
                          <span className={`text-xs px-1.5 py-0.5 rounded font-mono ${alarm.state === 'ACTIVE' ? 'bg-red-500/20 text-red-400' :
                              alarm.state === 'ACKNOWLEDGED' ? 'bg-yellow-500/20 text-yellow-400' :
                                'bg-green-500/20 text-green-400'
                            }`}>
                            {alarm.state}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {alarm.state === 'ACTIVE' && (
                          <button
                            onClick={() => handleAcknowledge(alarm.id)}
                            disabled={actionLoading === alarm.id}
                            className="px-3 py-1 text-xs font-medium rounded transition-all bg-muted text-muted-foreground hover:bg-primary hover:text-primary-foreground disabled:opacity-50"
                          >
                            {actionLoading === alarm.id ? '...' : 'ACK'}
                          </button>
                        )}
                        {alarm.state === 'ACKNOWLEDGED' && (
                          <button
                            onClick={() => handleClear(alarm.id)}
                            disabled={actionLoading === alarm.id}
                            className="px-3 py-1 text-xs font-medium rounded transition-all bg-green-500/20 text-green-400 border border-green-500/50 hover:bg-green-500/30 disabled:opacity-50"
                          >
                            {actionLoading === alarm.id ? '...' : 'CLEAR'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </MainLayout>
  );
}

export default function AlarmsPage() {
  return (
    <ProtectedRoute>
      <AlarmsContent />
    </ProtectedRoute>
  );
}
