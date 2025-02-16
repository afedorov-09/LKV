const width = window.innerWidth, height = window.innerHeight;

// Удаляем старый SVG перед созданием нового
d3.select("svg").remove();

// Создаём новый SVG
const svg = d3.select("body")
    .append("svg")
    .attr("width", width)
    .attr("height", height);

const linkGroup = svg.append("g").attr("class", "links");
const nodeGroup = svg.append("g").attr("class", "nodes");

let nodes = new Map();
let links = [];
let updateTimeout = null; // Таймер для обновления графа

const simulation = d3.forceSimulation()
    .force("link", d3.forceLink().id(d => d.id).distance(200)) // Увеличил расстояние между узлами
    .force("charge", d3.forceManyBody().strength(-150)) // Уменьшил отталкивание
    .force("center", d3.forceCenter(width / 2, height / 2))
    .force("collide", d3.forceCollide(30)) // Предотвращаем наложение узлов
    .force("x", d3.forceX(width / 2).strength(0.1))
    .force("y", d3.forceY(height / 2).strength(0.1));

const socket = new WebSocket("wss://ring-0.sh/ws");

socket.onopen = function() {
    console.log("✅ WebSocket подключен");
};

socket.onerror = function(error) {
    console.error("❌ Ошибка WebSocket:", error);
};

socket.onmessage = function(event) {
    const data = JSON.parse(event.data);
    console.log("🔹 Получены данные:", data);

    if (!data.processes || !data.network) {
        console.error("⚠ Нет данных о процессах или сети!");
        return;
    }

    console.log("🔗 Сетевые соединения:", data.network);

    let newNodes = new Map();
    let newLinks = [];

    // Добавляем основные компоненты ядра
    const coreNodes = [
        { id: "Scheduler", group: "core" },
        { id: "Processes", group: "core" },
        { id: "Memory", group: "core", value: data.memory },
        { id: "Network", group: "core" }
    ];
    coreNodes.forEach(node => newNodes.set(node.id, nodes.get(node.id) || node));

    newLinks.push({ source: "Processes", target: "Scheduler" });
    newLinks.push({ source: "Memory", target: "Scheduler" });
    newLinks.push({ source: "Network", target: "Scheduler" });

    // Добавляем процессы
    Object.entries(data.processes).forEach(([pid, process]) => {
        newNodes.set(pid, { id: pid, name: process.name, group: "process", value: 10 });
    });

    // Добавляем сетевые соединения
    data.network.forEach(conn => {
        if (!newNodes.has(conn.pid)) {
            newNodes.set(conn.pid, { id: conn.pid, name: `PID ${conn.pid}`, group: "process", value: 10 });
        }

        if (newNodes.has(conn.pid) && newNodes.has("Network")) {
            newLinks.push({ source: conn.pid, target: "Network", type: "network" });
        } else {
            console.warn(`⚠ Пропущено соединение: PID ${conn.pid} → Network (узел не найден)`);
        }
    });

    nodes = newNodes;
    links = newLinks;

    console.log(`📊 Узлов: ${nodes.size}, связей: ${links.length}`);

    if (updateTimeout) clearTimeout(updateTimeout);
    updateTimeout = setTimeout(updateGraph, 1000);
};

function updateGraph() {
    console.log("🔄 Обновляем граф...");

    const nodeArray = Array.from(nodes.values());

    const link = linkGroup.selectAll(".link")
        .data(links, d => `${d.source.id}-${d.target.id}`)
        .join("line")
        .attr("class", "link")
        .attr("stroke", d => d.type === "network" ? "green" : "#999")
        .attr("stroke-width", d => d.type === "network" ? 2 : 1.5);

    const node = nodeGroup.selectAll(".node")
        .data(nodeArray, d => d.id)
        .join("circle")
        .attr("class", "node")
        .attr("r", d => d.value || 10)
        .attr("fill", d => d.group === "process" ? "red" : "blue")
        .call(d3.drag()
            .on("start", dragStarted)
            .on("drag", dragged)
            .on("end", dragEnded));

    const labels = nodeGroup.selectAll(".label")
        .data(nodeArray, d => d.id)
        .join("text")
        .attr("class", "label")
        .attr("dx", 10)
        .attr("dy", 4)
        .text(d => d.name || d.id)
        .style("font-size", "10px");

    simulation.nodes(nodeArray);
    simulation.force("link").links(links);
    simulation.alpha(0.1).restart();
}

// Функции для перетаскивания узлов
function dragStarted(event, d) {
    if (!event.active) simulation.alphaTarget(0.3).restart();
    d.fx = d.x;
    d.fy = d.y;
}
function dragged(event, d) {
    d.fx = event.x;
    d.fy = event.y;
}
function dragEnded(event, d) {
    if (!event.active) simulation.alphaTarget(0);
    d.fx = null;
    d.fy = null;
}
