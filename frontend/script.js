const nodes = [
    { id: "Scheduler", value: 20 },
    { id: "Memory", value: 20 },
    { id: "Filesystem", value: 20 },
    { id: "Network", value: 20 },
    { id: "Drivers", value: 20 },
    { id: "Processes", value: 20 }
];

const links = [
    { source: "Scheduler", target: "Memory" },
    { source: "Scheduler", target: "Filesystem" },
    { source: "Scheduler", target: "Network" },
    { source: "Scheduler", target: "Drivers" },
    { source: "Memory", target: "Filesystem" },
    { source: "Memory", target: "Network" },
    { source: "Processes", target: "Scheduler" }
];

const width = window.innerWidth;
const height = 600;

const svg = d3.select("svg")
    .attr("width", width)
    .attr("height", height);

const simulation = d3.forceSimulation(nodes)
    .force("link", d3.forceLink(links).id(d => d.id).distance(150))
    .force("charge", d3.forceManyBody().strength(-300))
    .force("center", d3.forceCenter(width / 2, height / 2));

const link = svg.selectAll("line")
    .data(links)
    .enter().append("line")
    .attr("class", "link");

const node = svg.selectAll("circle")
    .data(nodes)
    .enter().append("circle")
    .attr("class", "node")
    .attr("r", d => d.value)
    .call(drag(simulation));  // Вызов функции drag()

const text = svg.selectAll("text")
    .data(nodes)
    .enter().append("text")
    .attr("class", "text-label")
    .attr("dy", 5)
    .text(d => d.id);

simulation.on("tick", () => {
    link
        .attr("x1", d => d.source.x)
        .attr("y1", d => d.source.y)
        .attr("x2", d => d.target.x)
        .attr("y2", d => d.target.y);

    node
        .attr("cx", d => d.x)
        .attr("cy", d => d.y);

    text
        .attr("x", d => d.x)
        .attr("y", d => d.y);
});

// Подключение WebSocket
const socket = new WebSocket("wss://ring-0.sh/ws");

socket.onmessage = function(event) {
    const data = JSON.parse(event.data);
    console.log("Обновление данных:", data);
    // Обновляем узлы
    nodes.forEach(node => {
        if (node.id === "Scheduler") node.value = data.cpu / 2;
        if (node.id === "Memory") node.value = data.memory / 2;
        if (node.id === "Processes") node.value = data.processes.length / 10;
    });

    // Анимация изменения размеров узлов
    node.transition()
        .duration(500)
        .attr("r", d => d.value)
        .style("fill", d => d.value > 30 ? "red" : "steelblue");
};

// Всплывающие подсказки
const tooltip = d3.select("#tooltip");

node.on("mouseover", function(event, d) {
    tooltip.style("visibility", "visible")
           .text(`${d.id}: ${d.value}`);
}).on("mousemove", function(event) {
    tooltip.style("top", (event.pageY + 10) + "px")
           .style("left", (event.pageX + 10) + "px");
}).on("mouseout", function() {
    tooltip.style("visibility", "hidden");
});

// 🔹 **Добавляем недостающую функцию drag()**
function drag(simulation) {
    function dragstarted(event, d) {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
    }

    function dragged(event, d) {
        d.fx = event.x;
        d.fy = event.y;
    }

    function dragended(event, d) {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
    }

    return d3.drag()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended);
