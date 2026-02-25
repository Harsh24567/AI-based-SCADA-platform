'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import {
  getLatest, getAlarms, getHealth,
  getAIAnomalies, getAIPredictions, getAIHealth,
  type SensorReading, type AlarmData, type HealthResponse,
  type AIAnomaly, type AIPrediction, type AIHealthResponse,
} from '@/lib/api';

// ── Exported types (consumed by dashboard components) ──

export interface ScadaMetrics {
  systemLoad: number;
  temperature: number;
  pressure: number;
  vibration: number;
  efficiency: number;
  machinesOnline: number;
  activeMachines: number;
  totalMachines: number;
  alarmCount: number;
  warningCount: number;
  uptimeSeconds: number;
}

export interface Machine {
  id: string;
  name: string;
  status: 'online' | 'offline' | 'warning' | 'error';
  temperature: number;
  vibration: number;
  pressure: number;
  runtime: number;
  efficiency: number;
  lastUpdate: Date;
}

export interface Alarm {
  id: string;
  machineId: string;
  machineName: string;
  severity: 'critical' | 'warning' | 'info';
  message: string;
  timestamp: Date;
  acknowledged: boolean;
  value: number;
  limit: number;
  state: string;
}

// ── Data transformers ──────────────────────────────────

const MACHINE_LABELS: Record<string, string> = {
  MOTOR_1: 'Motor Unit 1',
  PUMP_1: 'Pump Station 1',
  COMPRESSOR_1: 'Compressor 1',
};

function buildMachinesFromReadings(readings: SensorReading[]): Machine[] {
  // Group readings by machine_id
  const grouped: Record<string, Record<string, number>> = {};
  for (const r of readings) {
    if (!grouped[r.machine_id]) grouped[r.machine_id] = {};
    grouped[r.machine_id][r.field] = r.value;
  }

  return Object.entries(grouped).map(([id, fields]) => ({
    id,
    name: MACHINE_LABELS[id] || id,
    status: 'online' as const,
    temperature: Math.round((fields.temperature ?? 0) * 10) / 10,
    vibration: Math.round((fields.vibration ?? 0) * 100) / 100,
    pressure: Math.round((fields.pressure ?? 0) * 10) / 10,
    runtime: 0,
    efficiency: 0,
    lastUpdate: new Date(),
  }));
}

function mapSeverity(sev: string): 'critical' | 'warning' | 'info' {
  switch (sev.toUpperCase()) {
    case 'CRITICAL': return 'critical';
    case 'HIGH': return 'warning';
    case 'MEDIUM': return 'warning';
    case 'LOW': return 'info';
    case 'INFO': return 'info';
    default: return 'info';
  }
}

function buildAlarms(raw: AlarmData[]): Alarm[] {
  return raw.map(a => ({
    id: a.alarm_id,
    machineId: a.machine_id,
    machineName: MACHINE_LABELS[a.machine_id] || a.machine_id,
    severity: mapSeverity(a.severity),
    message: `${a.parameter} = ${a.value?.toFixed?.(1) ?? a.value} (limit: ${a.limit})`,
    timestamp: new Date(a.triggered_at),
    acknowledged: a.state === 'ACKNOWLEDGED',
    value: a.value,
    limit: a.limit,
    state: a.state,
  }));
}

function buildMetrics(
  machines: Machine[],
  alarms: Alarm[],
  health: HealthResponse | null,
): ScadaMetrics {
  const avgTemp = machines.length
    ? machines.reduce((s, m) => s + m.temperature, 0) / machines.length
    : 0;
  const avgPressure = machines.length
    ? machines.reduce((s, m) => s + m.pressure, 0) / machines.length
    : 0;
  const avgVib = machines.length
    ? machines.reduce((s, m) => s + m.vibration, 0) / machines.length
    : 0;

  return {
    systemLoad: Math.min(100, Math.round(avgTemp * 1.2)),
    temperature: Math.round(avgTemp * 10) / 10,
    pressure: Math.round(avgPressure * 10) / 10,
    vibration: Math.round(avgVib * 100) / 100,
    efficiency: machines.length > 0 ? Math.round(85 + Math.random() * 10) : 0,
    machinesOnline: machines.length,
    activeMachines: machines.filter(m => m.status === 'online').length,
    totalMachines: Math.max(machines.length, 3),
    alarmCount: alarms.filter(a => a.severity === 'critical').length,
    warningCount: alarms.filter(a => a.severity === 'warning').length,
    uptimeSeconds: health?.uptime_seconds ?? 0,
  };
}

// ── Hook ───────────────────────────────────────────────

const POLL_INTERVAL = 2000; // ms

export function useRealTimeData() {
  const [metrics, setMetrics] = useState<ScadaMetrics | null>(null);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [alarms, setAlarms] = useState<Alarm[]>([]);
  const [aiAnomalies, setAiAnomalies] = useState<AIAnomaly[]>([]);
  const [aiPredictions, setAiPredictions] = useState<AIPrediction[]>([]);
  const [aiHealth, setAiHealth] = useState<AIHealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchData = useCallback(async () => {
    try {
      // Fire all requests in parallel (core + AI)
      const [latestRes, alarmsRes, healthRes, aiAnomalyRes, aiPredRes, aiHealthRes] = await Promise.all([
        getLatest().catch(() => ({ data: [], alarms_evaluated: 0 })),
        getAlarms().catch(() => ({ active_alarms: [], total_count: 0 })),
        getHealth().catch(() => null),
        getAIAnomalies().catch(() => ({ anomalies: [], total_count: 0, detection_methods: [] })),
        getAIPredictions().catch(() => ({ predictions: [], total_count: 0, horizon_seconds: 300, threshold_warnings: [] })),
        getAIHealth().catch(() => null),
      ]);

      const machineList = buildMachinesFromReadings(latestRes.data);
      const alarmList = buildAlarms(alarmsRes.active_alarms);
      const metricData = buildMetrics(machineList, alarmList, healthRes);

      setMachines(machineList);
      setAlarms(alarmList);
      setMetrics(metricData);
      setAiAnomalies(aiAnomalyRes.anomalies);
      setAiPredictions(aiPredRes.predictions);
      if (aiHealthRes) setAiHealth(aiHealthRes);
      setConnected(true);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch data');
      setConnected(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(); // initial load
    intervalRef.current = setInterval(fetchData, POLL_INTERVAL);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchData]);

  return { metrics, machines, alarms, aiAnomalies, aiPredictions, aiHealth, loading, error, connected };
}
