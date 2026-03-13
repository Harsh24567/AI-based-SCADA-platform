/**
 * SCADA API Client
 *
 * Centralized HTTP client that handles JWT token management
 * and communicates with the FastAPI backend.
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// ── Token helpers ──────────────────────────────────────

export function getToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('scada_token');
}

export function setToken(token: string) {
    localStorage.setItem('scada_token', token);
}

export function clearToken() {
    localStorage.removeItem('scada_token');
}

// ── Generic fetch wrapper ──────────────────────────────

async function apiFetch<T>(
    path: string,
    options: RequestInit = {},
): Promise<T> {
    const token = getToken();
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(options.headers as Record<string, string>),
    };
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(`${API_BASE_URL}${path}`, {
        ...options,
        headers,
    });

    if (res.status === 401 || res.status === 403) {
        // Token expired or invalid → force re-login
        clearToken();
        if (typeof window !== 'undefined') {
            window.location.href = '/login';
        }
        throw new Error('Session expired');
    }

    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || `API error ${res.status}`);
    }

    return res.json();
}

// ── Auth ───────────────────────────────────────────────

export interface LoginResponse {
    access_token: string;
    token_type: string;
    role: string;
}

export async function login(username: string, password: string): Promise<LoginResponse> {
    const data = await apiFetch<LoginResponse>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
    });
    setToken(data.access_token);
    return data;
}

// ── Health ──────────────────────────────────────────────

export interface HealthResponse {
    status: string;
    services: Record<string, string>;
    uptime_seconds: number;
    alarms?: { active_count: number };
}

export async function getHealth(): Promise<HealthResponse> {
    // Health endpoint is public — no auth needed
    const res = await fetch(`${API_BASE_URL}/health`);
    return res.json();
}

// ── Latest sensor data ─────────────────────────────────

export interface SensorReading {
    machine_id: string;
    field: string;
    value: number;
    time: string;
}

export interface LatestResponse {
    data: SensorReading[];
    alarms_evaluated: number;
}

export async function getLatest(): Promise<LatestResponse> {
    return apiFetch<LatestResponse>('/latest');
}

// ── Alarms ─────────────────────────────────────────────

export interface AlarmData {
    alarm_id: string;
    machine_id: string;
    parameter: string;
    severity: string;
    state: string;
    value: number;
    limit: number;
    triggered_at: string;
    acknowledged_by?: string;
    cleared_at?: string;
}

export interface AlarmsResponse {
    active_alarms: AlarmData[];
    total_count: number;
}

export async function getAlarms(): Promise<AlarmsResponse> {
    return apiFetch<AlarmsResponse>('/alarms');
}

export async function acknowledgeAlarm(alarmId: string, user: string): Promise<any> {
    return apiFetch(`/alarms/${alarmId}/acknowledge`, {
        method: 'POST',
        body: JSON.stringify({ acknowledged_by: user }),
    });
}

export async function clearAlarm(alarmId: string): Promise<any> {
    return apiFetch(`/alarms/${alarmId}/clear`, { method: 'POST' });
}

export async function clearAllAlarms(): Promise<any> {
    return apiFetch('/alarms/clear-all', { method: 'POST' });
}

export interface AlarmHistoryResponse {
    history: AlarmData[];
}

export async function getAlarmHistory(): Promise<AlarmHistoryResponse> {
    return apiFetch<AlarmHistoryResponse>('/alarms/history');
}

// ── History ────────────────────────────────────────────

export interface HistoryResponse {
    data: SensorReading[];
}

export async function getHistory(params: {
    machine_id?: string;
    field?: string;
    start?: string;
    downsample?: string;
}): Promise<HistoryResponse> {
    const query = new URLSearchParams();
    if (params.machine_id) query.set('machine_id', params.machine_id);
    if (params.field) query.set('field', params.field);
    if (params.start) query.set('start', params.start);
    if (params.downsample) query.set('downsample', params.downsample);
    return apiFetch<HistoryResponse>(`/history?${query.toString()}`);
}

// ── Metrics ────────────────────────────────────────────

export interface MetricsResponse {
    uptime_seconds: number;
    api: Record<string, number>;
    alarms: Record<string, number>;
}

export async function getMetrics(): Promise<MetricsResponse> {
    return apiFetch<MetricsResponse>('/metrics');
}

// ── AI Engine ─────────────────────────────────────────

export interface AIAnomaly {
    machine_id: string;
    parameter: string;
    value: number;
    anomaly_type: string;
    confidence: number;
    description: string;
    detected_at: number;
}

export interface AIAnomaliesResponse {
    anomalies: AIAnomaly[];
    total_count: number;
    detection_methods: string[];
}

export interface AIPrediction {
    machine_id: string;
    parameter: string;
    current_value: number;
    predicted_value: number;
    horizon_seconds: number;
    trend_direction: string;
    trend_rate: number;
    confidence: number;
    threshold_eta_seconds?: number;
    threshold_eta_minutes?: number;
    threshold_value?: number;
}

export interface AIPredictionsResponse {
    predictions: AIPrediction[];
    total_count: number;
    horizon_seconds: number;
    threshold_warnings: AIPrediction[];
}

export interface AIHealthMachine {
    machine_id: string;
    score: number;
    grade: string;
    factors: Record<string, number>;
}

export interface AIHealthResponse {
    system_score: number;
    system_grade: string;
    machine_count: number;
    worst_machine?: string;
    worst_score?: number;
    machines: AIHealthMachine[];
    latest_insight?: string;
}

export async function getAIAnomalies(): Promise<AIAnomaliesResponse> {
    return apiFetch<AIAnomaliesResponse>('/ai/anomalies');
}

export async function getAIPredictions(): Promise<AIPredictionsResponse> {
    return apiFetch<AIPredictionsResponse>('/ai/predictions');
}

export async function getAIHealth(): Promise<AIHealthResponse> {
    return apiFetch<AIHealthResponse>('/ai/health');
}
