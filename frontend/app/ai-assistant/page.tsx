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
    TrendingUp, TrendingDown, Activity, Sparkles, Cpu, Terminal
} from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// Suggested prompts to help the user get started
const SUGGESTED_PROMPTS = [
    'System Status',
    'MOTOR_1 Stats',
    'Active Alarms',
    'Temperature Trends',
    'Machine Health',
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
function StatCard({ label, value, icon: Icon, color, shadowColor }: {
    label: string; value: number | undefined; icon: React.ComponentType<{ className?: string }>; color: string; shadowColor: string;
}) {
    if (value === undefined) return null;
    return (
        <div className={`relative flex flex-col items-center justify-center p-3 rounded bg-gradient-to-br from-black/40 to-transparent border border-[${color.split('-')[1]}]/30 min-w-[80px] overflow-hidden group`}>
            {/* Corner brackets */}
            <div className="absolute top-0 left-0 w-1.5 h-1.5 border-t border-l border-white/20" />
            <div className="absolute bottom-0 right-0 w-1.5 h-1.5 border-b border-r border-white/20" />
            
            <Icon className={`w-4 h-4 mb-2 ${color} ${shadowColor}`} />
            <span className="text-[9px] uppercase tracking-widest font-mono text-slate-400 mb-0.5">{label}</span>
            <span className={`text-sm font-mono font-bold ${color} ${shadowColor}`}>{value.toFixed(2)}</span>
        </div>
    );
}

// AI Message renderer with optional chart
function AssistantMessage({ msg }: { msg: Message }) {
    const hasChart = msg.chart_data && msg.chart_data.length > 0;
    const hasStats = msg.stats && Object.keys(msg.stats).length > 0;
    const hasDownloadUrl = !!msg.download_url;

    return (
        <div className="flex justify-start gap-4 max-w-full group/msg">
            <div className="relative flex-shrink-0 w-10 h-10 mt-1">
                <div className="absolute inset-0 bg-cyan-500/10 border border-cyan-500/30 rounded flex items-center justify-center shadow-[0_0_15px_rgba(6,182,212,0.15)] group-hover/msg:border-cyan-400/60 transition-colors">
                    <Bot className="w-5 h-5 text-cyan-400" />
                </div>
                {/* Circuit node styling */}
                <div className="absolute -right-2 top-1/2 w-2 h-[1px] bg-cyan-500/50" />
                <div className="absolute -right-3 top-1/2 w-1 h-1 rounded-full bg-cyan-400 -translate-y-1/2" />
            </div>
            
            <div className="flex-1 space-y-4 max-w-[calc(100%-3rem)] pt-1">
                {/* Text response - Terminal Window */}
                <div className="relative rounded bg-[#0a0f16] border border-cyan-500/30 shadow-[0_0_20px_rgba(6,182,212,0.05)] overflow-hidden">
                    {/* Header Bar */}
                    <div className="flex items-center justify-between px-3 py-1.5 bg-cyan-500/10 border-b border-cyan-500/20">
                        <div className="flex gap-2 items-center">
                            <span className="w-2 h-2 rounded bg-cyan-400 animate-pulse" />
                            <span className="text-[10px] font-mono text-cyan-400 uppercase tracking-widest">NEXUS_CORE_RESPONSE</span>
                        </div>
                        <span className="text-[9px] font-mono text-slate-500 uppercase">SYS.MSG</span>
                    </div>
                    
                    <div className="p-4 relative">
                        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-transparent via-cyan-500/5 to-transparent animate-[scan_3s_ease-in-out_infinite] opacity-50" />
                        <div className="absolute left-0 top-0 h-full w-[2px] bg-gradient-to-b from-transparent via-cyan-400/50 to-transparent" />
                        
                        <p className="text-[13px] text-cyan-50 font-mono leading-relaxed whitespace-pre-wrap pl-2 relative z-10">
                            {msg.content}
                            <span className="inline-block w-2 h-[1em] ml-1 align-middle bg-cyan-400/80 animate-pulse" />
                        </p>
                    </div>
                </div>

                {/* PDF Download Button */}
                {hasDownloadUrl && (
                    <div className="relative p-4 rounded bg-emerald-500/5 border border-emerald-500/30 flex items-center justify-between shadow-[0_0_15px_rgba(16,185,129,0.1)]">
                        <div className="absolute left-0 top-0 h-full w-1 bg-emerald-500 rounded-l" />
                        <div className="flex items-center gap-3 pl-2">
                            <div className="p-2 rounded bg-emerald-500/20">
                                <Terminal className="w-4 h-4 text-emerald-400" />
                            </div>
                            <div>
                                <h4 className="text-[11px] font-mono font-bold text-emerald-400 tracking-widest uppercase">Report Generated</h4>
                                <p className="text-[10px] text-emerald-500/70 font-mono uppercase mt-0.5">PDF Archive Ready For Download</p>
                            </div>
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            className="border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/20 hover:text-emerald-300 font-mono text-[10px] tracking-widest uppercase rounded h-8"
                            onClick={() => window.open(`${API_BASE}${msg.download_url}`, '_blank')}
                        >
                            [ DOWNLOAD ]
                        </Button>
                    </div>
                )}

                {/* Stats cards */}
                {hasStats && (
                    <div className="flex flex-wrap gap-3">
                        <StatCard label="Average" value={msg.stats?.avg} icon={Activity} color="text-indigo-400" shadowColor="drop-shadow-[0_0_5px_rgba(129,140,248,0.5)]" />
                        <StatCard label="Peak/Max" value={msg.stats?.max} icon={TrendingUp} color="text-rose-400" shadowColor="drop-shadow-[0_0_5px_rgba(251,113,133,0.5)]" />
                        <StatCard label="Trough/Min" value={msg.stats?.min} icon={TrendingDown} color="text-emerald-400" shadowColor="drop-shadow-[0_0_5px_rgba(52,211,153,0.5)]" />
                    </div>
                )}

                {/* Chart */}
                {hasChart && (
                    <div className="relative rounded bg-black/40 border border-white/10 p-4 pt-5 mt-2 overflow-hidden">
                        <div className="absolute top-0 w-full h-[1px] left-0 bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent" />
                        
                        {msg.chart_title && (
                            <div className="absolute top-2 left-4 flex items-center gap-2">
                                <Activity className="w-3 h-3 text-cyan-400" />
                                <span className="text-[9px] font-mono font-bold text-cyan-400 uppercase tracking-[0.2em]">
                                    {msg.chart_title}
                                </span>
                            </div>
                        )}
                        <ResponsiveContainer width="100%" height={220} className="mt-4">
                            <AreaChart data={msg.chart_data} margin={{ top: 10, right: 10, bottom: 5, left: -25 }}>
                                <defs>
                                    <linearGradient id="chartGradTech" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="rgb(6,182,212)" stopOpacity={0.4} />
                                        <stop offset="100%" stopColor="rgb(6,182,212)" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="2 4" stroke="rgba(255,255,255,0.05)" vertical={false} />
                                <XAxis
                                    dataKey="time"
                                    tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 9, fontFamily: 'monospace' }}
                                    interval="preserveStartEnd"
                                    tickLine={false}
                                    axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                                />
                                <YAxis
                                    tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 9, fontFamily: 'monospace' }}
                                    tickLine={false}
                                    axisLine={false}
                                />
                                <Tooltip
                                    contentStyle={{
                                        background: 'rgba(10, 15, 22, 0.95)',
                                        border: '1px solid rgba(6,182,212,0.3)',
                                        borderRadius: '4px',
                                        color: '#fff',
                                        fontSize: '11px',
                                        fontFamily: 'monospace',
                                        boxShadow: '0 0 15px rgba(6,182,212,0.1)'
                                    }}
                                    itemStyle={{ color: '#22d3ee' }}
                                />
                                <Area
                                    type="stepAfter"
                                    dataKey="value"
                                    stroke="#22d3ee"
                                    strokeWidth={2}
                                    fill="url(#chartGradTech)"
                                    dot={false}
                                    activeDot={{ r: 4, fill: '#22d3ee', stroke: '#fff', strokeWidth: 1 }}
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
                '> SYSTEM: SCADA AI Assistant Established.\n' +
                '> Awaiting operator input. Engage diagnostics below.',
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
                    content: data.text || 'Process exited with code 0. Analysis complete.',
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
                        '> ERROR: Connect timeout.\n' +
                        '> DETAILS: Unable to establish handshake with API_BASE.\n' +
                        '> RESOLUTION: Verify backend container status at ' +
                        API_BASE,
                },
            ]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <MainLayout>
            <div className="flex flex-col h-full bg-gradient-to-b from-background to-black/80 relative overflow-hidden">
                {/* Tech Grid Background overlay */}
                <div className="absolute inset-0 z-0 opacity-[0.03] pointer-events-none mix-blend-screen" 
                     style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)', backgroundSize: '20px 20px' }} />

                <div className="flex flex-col h-full p-4 md:p-6 lg:px-12 xl:px-32 gap-6 relative z-10 mx-auto w-full max-w-7xl">
                    {/* Header */}
                    <div className="flex items-center justify-between pb-4 border-b border-white/10">
                        <div className="flex items-center gap-4">
                            <div className="relative flex items-center justify-center w-12 h-12 rounded bg-cyan-500/10 border border-cyan-500/30">
                                <Cpu className="w-6 h-6 text-cyan-400" />
                                <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-cyan-400" />
                                <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-cyan-400" />
                            </div>
                            <div>
                                <h1 className="text-xl font-mono text-white tracking-widest uppercase flex items-center gap-2">
                                    SCADA AI Assistant <span className="px-1.5 py-0.5 rounded text-[9px] bg-cyan-500/20 text-cyan-400 border border-cyan-500/50">V_2.0</span>
                                </h1>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                    <p className="text-[10px] text-slate-400 font-mono tracking-widest uppercase">
                                        Neuromorphic Core Active · Ready
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Messages Area */}
                    <div
                        ref={scrollRef}
                        className="flex-1 overflow-y-auto space-y-8 pr-4 custom-scrollbar"
                    >
                        {messages.map((msg, i) => {
                            if (msg.role === 'user') {
                                return (
                                    <div key={i} className="flex justify-end gap-3 group/user">
                                        <div className="max-w-[75%] rounded bg-slate-800/80 border border-white/10 px-4 py-3 text-[13px] font-mono text-slate-200 leading-relaxed shadow-lg">
                                            {msg.content}
                                        </div>
                                        <div className="flex-shrink-0 w-10 h-10 rounded bg-white/5 border border-white/10 flex items-center justify-center -mt-1 group-hover/user:border-white/30 transition-colors">
                                            <User className="w-4 h-4 text-slate-300" />
                                        </div>
                                    </div>
                                );
                            }

                            if (msg.loading) {
                                return (
                                    <div key={i} className="flex justify-start gap-4">
                                        <div className="flex-shrink-0 w-10 h-10 mt-1 rounded bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center">
                                            <Loader2 className="w-5 h-5 animate-spin text-cyan-400" />
                                        </div>
                                        <div className="flex items-center gap-3 pt-3 pl-2">
                                            <span className="text-[10px] font-mono text-cyan-400 uppercase tracking-widest animate-pulse">Processing Query Vector...</span>
                                        </div>
                                    </div>
                                );
                            }

                            return <AssistantMessage key={i} msg={msg} />;
                        })}
                    </div>

                    {/* Bottom Input Area */}
                    <div className="pt-2">
                        {/* Suggested prompts */}
                        {messages.length < 3 && (
                            <div className="flex flex-wrap gap-2 mb-4">
                                {SUGGESTED_PROMPTS.map((p, i) => (
                                    <button
                                        key={i}
                                        onClick={() => sendMessage(p)}
                                        disabled={isLoading}
                                        className="text-[10px] font-mono uppercase tracking-wider px-3 py-2 rounded border border-white/10 text-slate-400 bg-black/20 hover:border-cyan-500/40 hover:text-cyan-400 hover:bg-cyan-500/5 transition-all disabled:opacity-30 disabled:cursor-not-allowed group relative overflow-hidden"
                                    >
                                        <span className="relative z-10">&gt; {p}</span>
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Input Form */}
                        <form
                            onSubmit={e => { e.preventDefault(); sendMessage(); }}
                            className="relative flex items-center border border-cyan-500/30 rounded bg-[#0a0f16] shadow-[0_0_20px_rgba(6,182,212,0.1)] focus-within:border-cyan-400 focus-within:shadow-[0_0_30px_rgba(6,182,212,0.2)] transition-all overflow-hidden"
                        >
                            <div className="pl-4 h-full flex items-center pt-1 border-r border-cyan-500/20 pr-3 bg-cyan-500/5">
                                <span className="text-cyan-500 font-mono font-bold animate-pulse">&gt;_</span>
                            </div>
                            <Input
                                value={input}
                                onChange={e => setInput(e.target.value)}
                                placeholder="ENTER QUERY PARAMETERS OR INSTRUCTIONS..."
                                disabled={isLoading}
                                className="flex-1 bg-transparent border-none text-[13px] font-mono text-cyan-50 placeholder:text-cyan-500/40 focus-visible:ring-0 focus-visible:ring-offset-0 h-12"
                            />
                            <div className="pr-2">
                                <Button 
                                    type="submit" 
                                    disabled={isLoading || !input.trim()} 
                                    className="shrink-0 bg-cyan-500/20 text-cyan-400 hover:bg-cyan-400 hover:text-black rounded-sm h-9 px-4 font-mono text-[11px] font-bold uppercase tracking-widest border border-cyan-500/50 transition-colors"
                                >
                                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Execute'}
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
                
                {/* Animations */}
                <style dangerouslySetInnerHTML={{__html: `
                    @keyframes scan {
                        0% { transform: translateY(-100%); }
                        100% { transform: translateY(100%); }
                    }
                `}} />
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
