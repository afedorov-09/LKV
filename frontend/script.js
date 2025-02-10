const nodes = [
    { id: "Scheduler", value: 20 },
    { id: "Memory", value: 20 },
    { id: "Filesystem", value: 20 },
    { id: "Network", value: 20 },
    { id: "Drivers", value: 20 }
];

const links = [
    { source: "Scheduler", target: "Memory" },
    { source: "Scheduler", target: "Filesystem" },
    { source: "Scheduler", target: "Network" },
    { source: "Scheduler", target: "Drivers" },
    { source: "Memory", target: "Filesystem" },
    { source: "Memory", target: "Network" }
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
    .call(drag(simulation));

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
}

// Подключение WebSocket для обновления данных в реальном времени
const socket = new WebSocket("ws://localhost:8000/ws");

socket.onmessage = function(event) {
    const data = JSON.parse(event.data);
    console.log("Обновление данных:", data);

    // Изменяем размер узлов в зависимости от загрузки CPU и памяти
    nodes.forEach(node => {
        if (node.id === "Scheduler") node.value = data.cpu / 2;
        if (node.id === "Memory") node.value = data.memory / 2;
    });

    node.transition()
        .duration(500)
        .attr("r", d => d.value);
};