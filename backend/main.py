from fastapi import FastAPI, WebSocket
import psutil
import json
import asyncio

app = FastAPI()

async def get_kernel_data():
    """Функция для получения данных о загрузке системы."""
    while True:
        data = {
            "cpu": psutil.cpu_percent(),
            "memory": psutil.virtual_memory().percent,
            "processes": len(psutil.pids())
        }
        yield json.dumps(data)
        await asyncio.sleep(1)

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket-сервер для отправки данных на фронтенд."""
    await websocket.accept()
    async for data in get_kernel_data():
        await websocket.send_text(data)