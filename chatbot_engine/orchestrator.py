"""
AI SCADA Platform — AI Agent Orchestrator (Modern Gemini Edition)

Uses the new google-genai SDK with automatic function calling.
Includes model fallback, structured analytics support, and safe error handling.
"""

import os
import json
from typing import List, Dict, Any, Optional
from google import genai
from google.genai import types as genai_types
from .tools import (
    query_latest_metrics,
    query_historical_stats,
    get_active_alarms,
    query_time_series,
)
from .predictive_tools import analyse_health, predict_time_to_failure
from .report_tools import generate_shift_report

# Models to try in order — the first one that works is used
FALLBACK_MODELS = [
    "gemini-1.5-flash",
    "gemini-2.5-flash",
    "gemini-flash-latest",
    "gemini-pro-latest",
]

SYSTEM_INSTRUCTION = (
    "You are the ELECSOL SCADA AI Assistant for an industrial factory. "
    "Your primary job is to answer control room queries accurately and concisely. "
    "DO NOT HALLUCINATE DATA. "
    "Available active Machines: 'MOTOR_1'. "
    "Available valid metrics: 'temperature', 'pressure', 'vibration', 'current', 'voltage'. "
    "When a user asks about a machine (e.g. 'compressor 1' or 'the machine'), ALWAYS assume 'MOTOR_1' and do not ask for clarification. "
    "If the user asks for a chart or graph, YOU MUST CALL 'query_time_series'. "
    "If the user asks for statistics, YOU MUST CALL 'query_historical_stats'. "
    "If the user asks about machine health, anomalies, or predictions, YOU MUST CALL 'analyse_health' or 'predict_time_to_failure'. "
    "If the user asks to generate a shift report or a PDF report, YOU MUST CALL 'generate_shift_report'. When you do, tell the user the report was generated and to use the download link provided below the chat. "
    "DO NOT output arrays of numbers or raw statistics in your text if you called a charting tool. "
    "Keep your text response incredibly short (1-2 sentences), as the chart itself will be rendered below your text."
)


class SCADAAgent:
    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.getenv("GOOGLE_API_KEY")
        if not self.api_key:
            raise ValueError(
                "Valid Google API Key not found. Please set GOOGLE_API_KEY in .env."
            )

        self.client = genai.Client(api_key=self.api_key)
        self.model_id = self._resolve_model()
        self.tools = [
            query_latest_metrics,
            query_historical_stats,
            get_active_alarms,
            query_time_series,
            analyse_health,
            predict_time_to_failure,
            generate_shift_report,
        ]

    def _resolve_model(self) -> str:
        """Try each model in the fallback list and return the first that responds."""
        for model in FALLBACK_MODELS:
            try:
                self.client.models.generate_content(
                    model=model,
                    contents="ping",
                    config={"max_output_tokens": 5},
                )
                return model
            except Exception:
                continue
        # Last resort
        return FALLBACK_MODELS[0]

    def _build_history(self, history: List[Dict]) -> List[genai_types.Content]:
        """Convert frontend history dictionary to genai Content objects."""
        contents = []
        if history:
            for msg in history:
                role = "user" if msg.get("role") == "user" else "model"
                contents.append(
                    genai_types.Content(
                        role=role, 
                        parts=[genai_types.Part.from_text(text=msg.get("content", ""))]
                    )
                )
        return contents

    def ask(self, message: str, history: List[Dict] = None) -> str:
        """Plain text Q&A using Gemini Chat with auto tool calling."""
        try:
            chat = self.client.chats.create(
                model=self.model_id,
                config={
                    "tools": self.tools,
                    "system_instruction": SYSTEM_INSTRUCTION,
                    "temperature": 0.2,
                },
                history=self._build_history(history)
            )
            response = chat.send_message(message)
            return response.text or "I could not generate a response. Please try again."
        except Exception as e:
            return f"Error: {str(e)}"

    def analyse(self, message: str, history: List[Dict] = None) -> Dict:
        """Rich analytics response leveraging auto tool execution and history parsing."""
        try:
            chat = self.client.chats.create(
                model=self.model_id,
                config={
                    "tools": self.tools,
                    "system_instruction": SYSTEM_INSTRUCTION,
                    "temperature": 0.1,  # Ultra strict
                },
                history=self._build_history(history)
            )
            
            response = chat.send_message(message)
            text = response.text or "Analysis complete."

            chart_data = []
            chart_title = ""
            stats = {}

            # Parse history backwards to find the last tool execution
            for msg in reversed(list(chat.get_history())):
                if not msg.parts:
                    continue
                for part in msg.parts:
                    if hasattr(part, "function_response") and part.function_response:
                        fn_name = part.function_response.name
                        # Note: In google-genai, response is wrapped in {'result': ...}
                        raw_result = part.function_response.response
                        fn_result = raw_result.get("result", raw_result) if isinstance(raw_result, dict) else raw_result

                        if isinstance(fn_result, dict):
                            if fn_name == "query_time_series" and "series" in fn_result and not chart_data:
                                chart_data = fn_result["series"]
                                chart_title = (
                                    f"{fn_result.get('machine_id', '')} — "
                                    f"{fn_result.get('metric', '')} "
                                    f"(last {fn_result.get('minutes', 30)} min)"
                                )
                                stats = fn_result.get("summary", {})
                                
                            elif fn_name == "query_historical_stats" and "avg" in fn_result and not stats:
                                stats = {
                                    "avg": fn_result.get("avg"),
                                    "max": fn_result.get("max"),
                                    "min": fn_result.get("min"),
                                    "count": fn_result.get("count"),
                                }
                                if not chart_title:
                                    chart_title = (
                                        f"{fn_result.get('machine_id', '')} — "
                                        f"{fn_result.get('metric', '')} stats"
                                    )

                # If we found chart data, stop walking backward
                if chart_data or stats:
                    break

            return {
                "text": text,
                "chart_data": chart_data,
                "chart_title": chart_title,
                "stats": stats,
            }

        except Exception as e:
            return {
                "text": f"Error during analysis: {str(e)}",
                "chart_data": [],
                "chart_title": "",
                "stats": {},
            }
