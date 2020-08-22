const domSelectedPort = document.getElementById("selected-port")
const domSerialPorts = document.getElementById("ports")
const domConnect = document.getElementById("connect")
const domStartSweep = document.getElementById("start-sweep")
const domView = document.getElementById("view")

let isPortOpen = false
let running = false
var all_data = []
var globalX = 0
var maxX = 256
var maxY = 1023

window.addEventListener("DOMContentLoaded", () => {
    setInterval(() => {
        if (!isPortOpen) {
            if (!domSerialPorts.classList.contains("active")) {
                window.api.send("get-ports")
            }
        }
    }, 5 * 1000)
});

domSerialPorts.addEventListener("mouseenter", (event) => {
    event.target.classList.add("active")
})

domSerialPorts.addEventListener("mouseout", (event) => {
    event.target.classList.remove("active")
})

domSelectedPort.addEventListener("submit", (event) => {
    event.preventDefault()
    const port = domSerialPorts.value
    if (isPortOpen) {
        window.api.send("disconnect-serial", port)
    }
    else {
        window.api.send("connect-serial", port)
    }
})

domStartSweep.addEventListener("click", () => {
    running = !running
    if (running) { all_data = [] }
    domStartSweep.innerText = running ? "Stop" : "Start"
    window.api.send("control-sweep", running)
})

window.api.receive("send-ports", (ports) => {
    const items = []
    ports.forEach(port => {
        items.push(`<option value="${port}">${port}</option>`)
    });
    domSerialPorts.innerHTML = items.join("")
})

window.api.receive("connection-open", (isOpen) => {
    if (isOpen) {
        domConnect.value = "Disconnect"
        domConnect.classList.add("disconnect")
        domConnect.classList.remove("connect")
        isPortOpen = true
    }
    else {
        domConnect.value = "Connect"
        domConnect.classList.add("connect")
        domConnect.classList.remove("disconnect")
        domStartSweep.disabled = true
        isPortOpen = false
    }
})

window.api.receive("send-data", (raw_data) => {
    const text_data = raw_data.split(",")
    if (text_data[0] == "ready") {
        domStartSweep.disabled = !isPortOpen
    }
    else {
        const data = text_data.map(d => Number(d))
        const [ch1, ch2, ch3, ch4, ch5, ch6, ...rest] = data
        running = !!ch1 ? true : false
        if (running) {
            domStartSweep.innerText = "Stop"
            globalX = ch2
            all_data.push({ x: ch2, y: ch3 })
            domView.innerText = `running ${ch2}`
        }
        else {
            domStartSweep.innerText = "Start"
        }
    }
})

/**
 *
 *  [sr,halt,mode,pcom,pstart,pend]
 * 
 * d3js chart
 *
 */
const width = 500;
const height = 200;
const duration = 50;
const max = maxX;
const step = 1;
const chart = d3.select('#chart')
    .attr('width', width + 50)
    .attr('height', height + 50);
const xScale = d3.scaleLinear().domain([0, maxX - 1]).range([0, width]);
const yScale = d3.scaleLinear().domain([maxY, 0]).range([height, 0]);
// -----------------------------------
const line = d3.line()
    .x(d => xScale(d.x))
    .y(d => yScale(d.y))
    .curve(d3.curveMonotoneX);
// -----------------------------------
// Draw the axis
const xAxis = d3.axisBottom().scale(xScale);
const axisX = chart.append('g').attr('class', 'x axis')
    .attr('transform', `translate(0, ${width})`)
    .call(xAxis);
// Append the holder for line chart
const path = chart.append('path');
// Main loop
function tick() {
    // Draw new line
    path.datum(all_data)
        .attr('class', 'line')
        .attr('d', line);
    axisX.transition()
        .duration(duration)
        .ease(d3.easeLinear, 2)
        .call(xAxis);
    path.attr('transform', null)
        .transition()
        .duration(duration)
        .ease(d3.easeLinear, 2)
        .on('end', tick)
}
tick();