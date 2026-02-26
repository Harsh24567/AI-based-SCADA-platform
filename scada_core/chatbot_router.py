import asyncio
from fastapi import APIRouter
from pydantic import BaseModel
from typing import List, Dict, Optional, Any
from chatbot_engine.orchestrator import SCADAAgent

router = APIRouter(prefix="/api/chatbot", tags=["chatbot"])


class ChatRequest(BaseModel):
    message: str
    history: Optional[List[Dict]] = []


class ChatResponse(BaseModel):
    response: str


class AnalyseResponse(BaseModel):
    text: str
    chart_data: List[Dict] = []
    chart_title: str = ""
    stats: Dict[str, Any] = {}


# Singleton agent instance
_agent: Optional[SCADAAgent] = None


def get_agent() -> Optional[SCADAAgent]:
    global _agent
    if _agent is None:
        try:
            _agent = SCADAAgent()
        except ValueError:
            return None
    return _agent


@router.post("/ask", response_model=ChatResponse)
async def ask_chatbot(request: ChatRequest):
    """Plain text Q&A endpoint."""
    agent_instance = get_agent()
    if agent_instance is None:
        return {"response": "AI Agent is not configured. Please set GOOGLE_API_KEY in the backend .env file."}

    # Run in thread pool to avoid blocking the async event loop (fixes buffering)
    response_text = await asyncio.to_thread(
        agent_instance.ask, request.message, request.history
    )
    return {"response": response_text}


@router.post("/analyse", response_model=AnalyseResponse)
async def analyse_chatbot(request: ChatRequest):
    """Rich analytics endpoint — returns text + chart data + stats."""
    agent_instance = get_agent()
    if agent_instance is None:
        return {
            "text": "AI Agent is not configured. Please set GOOGLE_API_KEY in .env.",
            "chart_data": [],
            "chart_title": "",
            "stats": {},
        }

    # Run in thread pool to avoid blocking the async event loop
    result = await asyncio.to_thread(
        agent_instance.analyse, request.message, request.history
    )
    return result
