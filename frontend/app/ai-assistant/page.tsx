'use client';

import React, { useState, useRef, useEffect } from 'react';
import MainLayout from '@/components/MainLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, Area, AreaChart,
} from 'recharts';
import {
    Bot, User, Send, Loader2, BrainCircuit,
    TrendingUp, TrendingDown, Activity, Sparkles,
} from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// Suggested prompts to help the user get started
const SUGGESTED_PROMPTS = [
    'Show me the latest status of all machines',
    'Describe and show statistics for MOTOR_1 over the last 30 minutes',
    'Are there any active alarms?',
    'What is the temperature trend for MOTOR_1?',
    'Give me the current health of all machines',
];

interface ChartData { time: string; value: number | null; }
interface Stats { avg?: number; max?: number; min?: number; count?: number; }

interface Message {
    role: 'user' | 'assistant';
    content: string;
    chart_data?: ChartData[];
    chart_title?: string;
    stats?: Stats;
    download_url?: string;
    loading?: boolean;
}

// Stat card component
function StatCard({ label, value, icon: Icon, color }: {
    label: string; value: number | undefined; icon: React.ComponentType<{ className?: string }>; color: string;
}) {
    if (value === undefined) return null;
    return (
        <div className={`flex flex-col items-center justify-center p-3 rounded-lg bg-white/[0.05] border border-white/[0.08] min-w-[80px]`}>
            <Icon className={`w-4 h-4 mb-1 ${color}`} />
            <span className="text-xs text-muted-foreground">{label}</span>
            <span className={`text-sm font-bold ${color}`}>{value.toFixed(2)}</span>
        </div>
    );
}

// AI Message renderer with optional chart
function AssistantMessage({ msg }: { msg: Message }) {
    const hasChart = msg.chart_data && msg.chart_data.length > 0;
    const hasStats = msg.stats && Object.keys(msg.stats).length > 0;
    const hasDownloadUrl = !!msg.download_url;

    return (
        <div className="flex justify-start gap-3 max-w-full">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-accent/20 border border-accent/30 flex items-center justify-center mt-1">
                <BrainCircuit className="w-4 h-4 text-accent" />
            </div>
            <div className="flex-1 space-y-3 max-w-[calc(100%-3rem)]">
                {/* Text response */}
                <div className="glass-sm rounded-xl p-4 border border-white/[0.1] text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                    {msg.content}
                </div>

                {/* PDF Download Button */}
                {hasDownloadUrl && (
                    <div className="glass-sm rounded-xl p-4 border border-accent/40 bg-accent/5">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Sparkles className="w-5 h-5 text-accent" />
                                <div>
                                    <h4 className="text-sm font-semibold text-foreground">Shift Report Ready</h4>
                                    <p className="text-xs text-muted-foreground font-light">Your PDF report has been generated successfully.</p>
                                </div>
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                className="border-accent text-accent hover:bg-accent/10"
                                onClick={() => window.open(`${API_BASE}${msg.download_url}`, '_blank')}
                            >
                                Download PDF
                            </Button>
                        </div>
                    </div>
                )}

                {/* Stats cards */}
                {hasStats && (
                    <div className="flex flex-wrap gap-2">
                        <StatCard label="Avg" value={msg.stats?.avg} icon={Activity} color="text-blue-400" />
                        <StatCard label="Max" value={msg.stats?.max} icon={TrendingUp} color="text-red-400" />
                        <StatCard label="Min" value={msg.stats?.min} icon={TrendingDown} color="text-green-400" />
                    </div>
                )}

                {/* Chart */}
                {hasChart && (
                    <div className="glass-sm rounded-xl p-4 border border-white/[0.1]">
                        {msg.chart_title && (
                            <div className="flex items-center gap-2 mb-3">
                                <Sparkles className="w-4 h-4 text-accent" />
                                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                    {msg.chart_title}
                                </span>
                            </div>
                        )}
                        <ResponsiveContainer width="100%" height={180}>
                            <AreaChart data={msg.chart_data} margin={{ top: 5, right: 10, bottom: 5, left: -20 }}>
                                <defs>
                                    <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="hsl(var(--accent))" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="hsl(var(--accent))" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                                <XAxis
                                    dataKey="time"
                                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                                    interval="preserveStartEnd"
                                    tickLine={false}
                                    axisLine={false}
                                />
                                <YAxis
                                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                                    tickLine={false}
                                    axisLine={false}
                                />
                                <Tooltip
                                    contentStyle={{
                                        background: 'hsl(var(--card))',
                                        border: '1px solid rgba(255,255,255,0.1)',
                                        borderRadius: '8px',
                                        color: 'hsl(var(--foreground))',
                                        fontSize: '12px',
                                    }}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="value"
                                    stroke="hsl(var(--accent))"
                                    strokeWidth={2}
                                    fill="url(#chartGrad)"
                                    dot={false}
                                    activeDot={{ r: 4, fill: 'hsl(var(--accent))' }}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </div>
        </div>
    );
}

function AIAssistantContent() {
    const [messages, setMessages] = useState<Message[]>([
        {
            role: 'assistant',
            content:
                'Hello! I am your ELECSOL SCADA AI Assistant powered by Gemini.\n\n' +
                'I can answer questions about your factory machines, show real-time statistics, plot trends, and alert you to active alarms.\n\n' +
                'Try one of the suggestions below or type your own question!',
        },
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    const sendMessage = async (text?: string) => {
        const userMessage = (text || input).trim();
        if (!userMessage || isLoading) return;

        setInput('');
        setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
        setIsLoading(true);

        // Optimistic loading bubble
        setMessages(prev => [...prev, { role: 'assistant', content: '', loading: true }]);

        try {
            const response = await fetch(`${API_BASE}/api/chatbot/analyse`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: userMessage, history: [] }),
            });

            if (!response.ok) {
                throw new Error(`Server error: ${response.status}`);
            }

            const data = await response.json();

            setMessages(prev => [
                ...prev.filter(m => !m.loading),
                {
                    role: 'assistant',
                    content: data.text || 'Analysis complete.',
                    chart_data: data.chart_data || [],
                    chart_title: data.chart_title || '',
                    stats: data.stats || {},
                    download_url: data.download_url || undefined,
                },
            ]);
        } catch (error) {
            setMessages(prev => [
                ...prev.filter(m => !m.loading),
                {
                    role: 'assistant',
                    content:
                        'Sorry, I encountered an error connecting to the AI backend. ' +
                        'Please make sure the SCADA API is running at ' +
                        API_BASE,
                },
            ]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <MainLayout>
            <div className="flex flex-col h-full p-6 gap-4">
                {/* Header */}
                <div className="flex items-center gap-4 pb-2 border-b border-white/[0.08]">
                    <div className="w-10 h-10 rounded-xl bg-accent/20 border border-accent/30 flex items-center justify-center">
                        <BrainCircuit className="w-5 h-5 text-accent" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-light tracking-tight text-foreground">AI Assistant</h1>
                        <p className="text-xs text-muted-foreground font-light">
                            Powered by Gemini · Real-time SCADA data · Visual Analytics
                        </p>
                    </div>
                </div>

                {/* Messages */}
                <div
                    ref={scrollRef}
                    className="flex-1 overflow-y-auto space-y-5 pr-2 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10"
                >
                    {messages.map((msg, i) => {
                        if (msg.role === 'user') {
                            return (
                                <div key={i} className="flex justify-end gap-3">
                                    <div className="max-w-[70%] bg-primary/80 text-primary-foreground rounded-xl px-4 py-3 text-sm leading-relaxed">
                                        {msg.content}
                                    </div>
                                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/30 border border-primary/40 flex items-center justify-center mt-1">
                                        <User className="w-4 h-4 text-primary-foreground" />
                                    </div>
                                </div>
                            );
                        }

                        if (msg.loading) {
                            return (
                                <div key={i} className="flex justify-start gap-3">
                                    <div className="w-8 h-8 rounded-full bg-accent/20 border border-accent/30 flex items-center justify-center">
                                        <BrainCircuit className="w-4 h-4 text-accent" />
                                    </div>
                                    <div className="glass-sm rounded-xl p-4 border border-white/[0.1] flex items-center gap-2">
                                        <Loader2 className="w-4 h-4 animate-spin text-accent" />
                                        <span className="text-sm text-muted-foreground">Analysing with Gemini...</span>
                                    </div>
                                </div>
                            );
                        }

                        return <AssistantMessage key={i} msg={msg} />;
                    })}
                </div>

                {/* Suggested prompts */}
                {messages.length < 3 && (
                    <div className="flex flex-wrap gap-2">
                        {SUGGESTED_PROMPTS.map((p, i) => (
                            <button
                                key={i}
                                onClick={() => sendMessage(p)}
                                disabled={isLoading}
                                className="text-xs px-3 py-1.5 rounded-full border border-white/[0.12] text-muted-foreground hover:border-accent/40 hover:text-accent transition-colors disabled:opacity-40"
                            >
                                {p}
                            </button>
                        ))}
                    </div>
                )}

                {/* Input bar */}
                <form
                    onSubmit={e => { e.preventDefault(); sendMessage(); }}
                    className="flex gap-3 pt-2 border-t border-white/[0.08]"
                >
                    <Input
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        placeholder="Ask about machines, alarms, trends… (e.g. Show me MOTOR_1 temperature chart)"
                        disabled={isLoading}
                        className="flex-1 bg-white/[0.05] border-white/[0.1] text-sm placeholder:text-muted-foreground/60 focus:border-accent/50"
                    />
                    <Button type="submit" disabled={isLoading || !input.trim()} className="shrink-0">
                        {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    </Button>
                </form>
            </div>
        </MainLayout>
    );
}

import ClientOnly from '@/components/ClientOnly';

export default function AIAssistantPage() {
    return (
        <ProtectedRoute>
            <ClientOnly>
                <AIAssistantContent />
            </ClientOnly>
        </ProtectedRoute>
    );
}
