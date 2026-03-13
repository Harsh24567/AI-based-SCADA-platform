import os
from google import genai
from google.genai import types

def fake_query_time_series(machine_id: str, metric: str, minutes: int = 30) -> dict:
    """Returns time-series data points for plotting charts."""
    return {
        "machine_id": machine_id,
        "metric": metric,
        "minutes": minutes,
        "series": [{"time": "10:00", "value": 50}, {"time": "10:01", "value": 52}],
        "summary": {"avg": 51, "max": 52, "min": 50, "count": 2}
    }

from dotenv import load_dotenv

load_dotenv(override=True)
api_key = os.getenv("GOOGLE_API_KEY")
client = genai.Client(api_key=api_key)

config = {
    "tools": [fake_query_time_series],
    "system_instruction": "You are a SCADA AI. Always call fake_query_time_series when asked for charts.",
    "temperature": 0.2
}

chat = client.chats.create(model="gemini-2.5-flash", config=config)
response = chat.send_message("Show me the pressure chart for compressor 1")

print("Final response text:", response.text)

for i, msg in enumerate(chat.get_history()):
    print(f"--- History {i}, role: {msg.role} ---")
    if msg.parts:
        for p in msg.parts:
            if hasattr(p, "function_call") and p.function_call:
                print("Function Call:", p.function_call.name, p.function_call.args)
            elif hasattr(p, "function_response") and p.function_response:
                print("Function Response:", p.function_response.name, p.function_response.response)
            elif p.text:
                print("Text:", p.text)
