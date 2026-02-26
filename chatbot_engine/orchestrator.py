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

# Models to try in order — the first one that works is used
FALLBACK_MODELS = [
    "gemini-2.5-flash",
    "gemini-flash-latest",
    "gemini-pro-latest",
]

SYSTEM_INSTRUCTION = (
    "You are the ELECSOL SCADA AI Assistant for an industrial factory. "
    "You have access to real-time PLC sensor data via tools. "
    "Always call the appropriate tool to get live data before answering. "
    "When asked for statistics or trends on a machine, call query_time_series "
    "to get chart data AND query_historical_stats to get numeric stats. "
    "Format your text responses clearly with bullet points where appropriate. "
    "Be concise and professional."
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
        # Last resort — let the first attempt fail naturally with a clear error
        return FALLBACK_MODELS[0]

    def ask(self, message: str, history: List[Dict] = None) -> str:
        """Plain text Q&A using Gemini with auto tool calling."""
        try:
            response = self.client.models.generate_content(
                model=self.model_id,
                contents=message,
                config={
                    "tools": self.tools,
                    "system_instruction": SYSTEM_INSTRUCTION,
                },
            )
            return response.text or "I could not generate a response. Please try again."
        except Exception as e:
            return f"Error: {str(e)}"

    def analyse(self, message: str, history: List[Dict] = None) -> Dict:
        """
        Rich analytics response. Returns a dict with:
            {
              "text": str,            # narrative explanation
              "chart_data": [...],    # [{time, value}, ...] or []
              "chart_title": str,     # e.g. "MOTOR_1 — temperature (last 30 min)"
              "stats": {...}          # avg, max, min, count or {}
            }
        """
        try:
            # First, get a plain answer which may include tool call results
            response = self.client.models.generate_content(
                model=self.model_id,
                contents=message,
                config={
                    "tools": self.tools,
                    "system_instruction": (
                        SYSTEM_INSTRUCTION
                        + " When asked to describe or analyse a machine, you MUST call "
                        "query_time_series to get chart data, and query_historical_stats "
                        "for numeric stats. Include both in your response tools."
                    ),
                },
            )

            text = response.text or "Analysis complete."

            # Detect if tool results embedded chart/stats data in the raw response
            chart_data = []
            chart_title = ""
            stats = {}

            # Walk function_calls from the response to extract chart / stats data
            for candidate in (response.candidates or []):
                for part in (candidate.content.parts if candidate.content else []):
                    if hasattr(part, "function_response") and part.function_response:
                        fn_name = part.function_response.name
                        fn_result = part.function_response.response

                        if fn_name == "query_time_series" and isinstance(fn_result, dict):
                            if "series" in fn_result:
                                chart_data = fn_result["series"]
                                chart_title = (
                                    f"{fn_result.get('machine_id', '')} — "
                                    f"{fn_result.get('metric', '')} "
                                    f"(last {fn_result.get('minutes', 30)} min)"
                                )
                                stats = fn_result.get("summary", {})

                        elif fn_name == "query_historical_stats" and isinstance(fn_result, dict):
                            if not stats and "avg" in fn_result:
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
