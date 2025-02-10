from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
import psutil
import json
import asyncio

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {"message": "FastAPI is running"}

def get_network_activity():
    with open("/proc/net/dev", "r") as f:
        lines = f.readlines()[2:]  
        network_data = {}
        for line in lines:
            parts = line.split()
            interface = parts[0].strip(":")
            received = int(parts[1])  
            transmitted = int(parts[9]) 
            network_data[interface] = {"rx": received, "tx": transmitted}
        return network_data

def get_running_processes():
    return [p.info for p in psutil.process_iter(['pid', 'name', 'cpu_percent'])]

async def get_kernel_data():
    while True:
        data = {
            "cpu": psutil.cpu_percent(),
            "memory": psutil.virtual_memory().percent,
            "processes": get_running_processes(),
            "network": get_network_activity()
        }
        yield json.dumps(data)
        await asyncio.sleep(1)

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket-сервер для отправки данных на фронтенд."""
    await websocket.accept()
    async for data in get_kernel_data():
        await websocket.send_text(data)
