'use client';

import React, { useState, useEffect, useCallback } from 'react';
import MainLayout from '@/components/MainLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { Calendar, Download, Filter } from 'lucide-react';
import { getHistory, getAlarmHistory, type SensorReading, type AlarmData } from '@/lib/api';

const TIME_RANGES: Record<string, { start: string; downsample: string; label: string }> = {
  '1h': { start: '-1h', downsample: '1m', label: 'Last Hour' },
  '6h': { start: '-6h', downsample: '5m', label: 'Last 6 Hours' },
  '24h': { start: '-24h', downsample: '15m', label: 'Last 24 Hours' },
  '7d': { start: '-7d', downsample: '1h', label: 'Last 7 Days' },
  '30d': { start: '-30d', downsample: '6h', label: 'Last 30 Days' },
};

const MACHINES = ['ALL', 'MOTOR_1', 'PUMP_1', 'COMPRESSOR_1'];

function HistoryContent() {
  const [range, setRange] = useState('1h');
  const [machine, setMachine] = useState('ALL');
  const [chartData, setChartData] = useState<any[]>([]);
  const [alarmHistoryData, setAlarmHistoryData] = useState<AlarmData[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { start, downsample } = TIME_RANGES[range];

      // Fetch sensor history + alarm history in parallel
      const [histRes, alarmRes] = await Promise.all([
        getHistory({
          machine_id: machine !== 'ALL' ? machine : undefined,
          start,
          downsample,
        }).catch(() => ({ data: [] })),
        getAlarmHistory().catch(() => ({ history: [] })),
      ]);

      // Transform time-series data: group by timestamp, pivot fields
      const byTime: Record<string, Record<string, number>> = {};
      for (const r of histRes.data) {
        const t = new Date(r.time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        if (!byTime[t]) byTime[t] = {};
        byTime[t][r.field] = Math.round(r.value * 10) / 10;
      }

      const transformed = Object.entries(byTime).map(([time, fields]) => ({
        time,
        temperature: fields.temperature ?? null,
        vibration: fields.vibration ?? null,
        pressure: fields.pressure ?? null,
      }));

      setChartData(transformed);
      setAlarmHistoryData(alarmRes.history);
    } catch (err) {
      console.error('Failed to fetch history:', err);
    } finally {
      setLoading(false);
    }
  }, [range, machine]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <MainLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold text-foreground">Historical Data</h2>
            <p className="text-muted-foreground mt-1">System performance and event history</p>
          </div>
          <button className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors font-medium">
            <Download size={18} />
            Export Data
          </button>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Calendar size={18} className="text-muted-foreground" />
            {Object.entries(TIME_RANGES).map(([key, { label }]) => (
              <button
                key={key}
                onClick={() => setRange(key)}
                className={`px-3 py-1 rounded-full text-sm font-medium transition-all ${range === key
                    ? 'bg-accent text-accent-foreground'
                    : 'bg-card border border-border text-muted-foreground hover:text-foreground'
                  }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <Filter size={18} className="text-muted-foreground" />
            <select
              value={machine}
              onChange={(e) => setMachine(e.target.value)}
              className="px-3 py-1.5 bg-card border border-border rounded-lg text-sm text-foreground focus:outline-none focus:border-accent"
            >
              {MACHINES.map(m => (
                <option key={m} value={m}>{m === 'ALL' ? 'All Machines' : m}</option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-accent"></div>
          </div>
        ) : (
          <>
            {/* Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Temperature & Pressure Chart */}
              <div className="bg-card border border-border rounded-lg p-6">
                <h3 className="text-lg font-bold text-foreground mb-4">Temperature & Pressure</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                    <XAxis dataKey="time" tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 12 }} stroke="rgba(255,255,255,0.1)" />
                    <YAxis tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 12 }} stroke="rgba(255,255,255,0.1)" />
                    <Tooltip contentStyle={{ backgroundColor: 'rgba(10, 14, 23, 0.9)', border: '1px solid rgba(0, 212, 255, 0.3)', borderRadius: '8px' }} />
                    <Legend />
                    <Line type="monotone" dataKey="temperature" stroke="hsl(195, 100%, 50%)" strokeWidth={2} name="Temp °C" dot={false} />
                    <Line type="monotone" dataKey="pressure" stroke="hsl(140, 100%, 50%)" strokeWidth={2} name="Pressure bar" dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Vibration Chart */}
              <div className="bg-card border border-border rounded-lg p-6">
                <h3 className="text-lg font-bold text-foreground mb-4">Vibration</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                    <XAxis dataKey="time" tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 12 }} stroke="rgba(255,255,255,0.1)" />
                    <YAxis tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 12 }} stroke="rgba(255,255,255,0.1)" />
                    <Tooltip contentStyle={{ backgroundColor: 'rgba(10, 14, 23, 0.9)', border: '1px solid rgba(0, 212, 255, 0.3)', borderRadius: '8px' }} />
                    <Legend />
                    <Line type="monotone" dataKey="vibration" stroke="hsl(30, 100%, 50%)" strokeWidth={2} name="Vibration mm/s" dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Alarm History */}
            <div className="bg-card border border-border rounded-lg p-6">
              <h3 className="text-lg font-bold text-foreground mb-4">Alarm History</h3>
              {alarmHistoryData.length === 0 ? (
                <p className="text-muted-foreground text-sm py-8 text-center">No past alarms in history</p>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {alarmHistoryData.map((alarm, idx) => {
                    const sevColor = alarm.severity === 'CRITICAL' ? 'text-red-400 bg-red-500/10 border-red-500/30' :
                      alarm.severity === 'HIGH' ? 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30' :
                        'text-blue-400 bg-blue-500/10 border-blue-500/30';
                    return (
                      <div key={idx} className={`p-3 rounded-lg border transition-all ${sevColor}`}>
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <p className="text-sm font-semibold">{alarm.machine_id} — {alarm.parameter}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              Value: {alarm.value} (limit: {alarm.limit}) • Severity: {alarm.severity}
                            </p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <span className="text-xs text-muted-foreground font-mono">
                              {new Date(alarm.triggered_at).toLocaleString('en-US', {
                                month: 'short', day: 'numeric',
                                hour: '2-digit', minute: '2-digit',
                              })}
                            </span>
                            {alarm.cleared_at && (
                              <p className="text-xs text-green-400 mt-1">
                                Cleared {new Date(alarm.cleared_at).toLocaleTimeString('en-US', {
                                  hour: '2-digit', minute: '2-digit',
                                })}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </MainLayout>
  );
}

export default function HistoryPage() {
  return (
    <ProtectedRoute>
      <HistoryContent />
    </ProtectedRoute>
  );
}
