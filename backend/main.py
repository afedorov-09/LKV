import subprocess
from fastapi import FastAPI, WebSocket
import psutil
import json
import asyncio

app = FastAPI()

def get_network_connections():
    """Получаем список активных сетевых соединений и сопоставляем их с процессами."""
    connections = []
    pid_map = {p.info['pid']: p.info['name'] for p in psutil.process_iter(['pid', 'name'])}

    for conn in psutil.net_connections(kind="inet"):
        if conn.status == "ESTABLISHED" and conn.laddr and conn.raddr:
            pid = conn.pid

            # Альтернативный метод: поиск PID через lsof, если psutil не нашел его
            if not pid:
                try:
                    result = subprocess.run(
                        ["sudo", "lsof", "-i", f"tcp:{conn.laddr.port}"],
                        capture_output=True, text=True
                    )
                    lines = result.stdout.split("\n")
                    for line in lines[1:]:  # Пропускаем заголовок
                        parts = line.split()
                        if len(parts) > 1 and parts[1].isdigit():
                            pid = int(parts[1])
                            break
                except Exception as e:
                    print("⚠️ Ошибка при вызове lsof:", e)

            connections.append({
                "pid": pid if pid else "Unknown",
                "process": pid_map.get(pid, "Unknown"),
                "local_ip": conn.laddr.ip,
                "local_port": conn.laddr.port,
                "remote_ip": conn.raddr.ip,
                "remote_port": conn.raddr.port,
                "status": conn.status
            })

    print(f"🔗 Найдено соединений: {len(connections)}")
    return connections

async def get_kernel_data():
    """Формируем JSON с системными метриками."""
    try:
        while True:
            data = {
                "cpu": psutil.cpu_percent(percpu=True),
                "memory": psutil.virtual_memory().percent,
                "network": get_network_connections(),  # Добавляем сеть
                "processes": {p.pid: {"name": p.info["name"], "ppid": p.info["ppid"]} 
                              for p in psutil.process_iter(['pid', 'name', 'ppid'])}
            }
            print(f"📡 Отправка данных: {json.dumps(data, indent=2)}")  # Лог отправки данных
            yield json.dumps(data)
            await asyncio.sleep(1)
    except asyncio.CancelledError:
        print("🔴 WebSocket-соединение закрыто.")
        raise  

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket-сервер для отправки данных на фронтенд."""
    await websocket.accept()
    try:
        async for data in get_kernel_data():
            await websocket.send_text(data)
    except asyncio.CancelledError:
        print("🔴 WebSocket-соединение прервано.")
    finally:
        print("🟡 WebSocket-закрытие корректно обработано.")
