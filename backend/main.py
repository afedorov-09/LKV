from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
import psutil
import json
import asyncio

app = FastAPI()

# Разрешаем CORS для взаимодействия с фронтендом (если он на другом домене)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://ring-0.sh"],  # Используем только нужный домен
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(TrustedHostMiddleware, allowed_hosts=["ring-0.sh", "127.0.0.1", "localhost", "*"])

@app.get("/")
async def root():
    """Тестовый эндпоинт, проверяем, работает ли FastAPI"""
    return {"message": "FastAPI is running"}

def get_network_activity():
    """Получаем статистику сетевых интерфейсов из /proc/net/dev."""
    with open("/proc/net/dev", "r") as f:
        lines = f.readlines()[2:]  # Пропускаем заголовки
        network_data = {}
        for line in lines:
            parts = line.split()
            interface = parts[0].strip(":")
            received = int(parts[1])  # Входящий трафик (байты)
            transmitted = int(parts[9])  # Исходящий трафик (байты)
            network_data[interface] = {"rx": received, "tx": transmitted}
        return network_data

def get_running_processes():
    """Получаем список активных процессов из /proc."""
    return [p.info for p in psutil.process_iter(['pid', 'name', 'cpu_percent'])]

async def get_kernel_data():
    """Формируем JSON с системными метриками."""
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
    """WebSocket-сервер, отправляющий корректные JSON-ответы"""
    await websocket.accept()
    await websocket.send_json({"status": "connected"})  # Сообщаем, что подключение установлено

    while True:
        try:
            # Отправляем тестовый JSON с CPU, RAM и процессами
            data = {
                "cpu": psutil.cpu_percent(),
                "memory": psutil.virtual_memory().percent,
                "processes": [{"pid": p.pid, "name": p.name()} for p in psutil.process_iter(['pid', 'name'])][:10]  # Ограничим до 10 процессов
            }
            await websocket.send_json(data)  # Отправляем JSON
            await asyncio.sleep(1)  # Раз в секунду
        except Exception as e:
            print(f"Ошибка WebSocket: {e}")
            break
