const domSelectedPort = document.getElementById("selected-port")
const domSerialPorts = document.getElementById("ports")
const domConnect = document.getElementById("connect")
const domStartSweep = document.getElementById("start-sweep")
const domView = document.getElementById("view")

let isPortOpen = false
let running = false
var all_data = []
var globalX = 0

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
var width = 500;
var height = 200;
var duration = 100;
var max = 500;
var step = 10;
var chart = d3.select('#chart')
    .attr('width', width + 50)
    .attr('height', height + 50);
var x = d3.scaleLinear().domain([0, 500]).range([0, 500]);
var y = d3.scaleLinear().domain([0, 500]).range([500, 0]);
// -----------------------------------
var line = d3.line()
    .x(function (d) { return x(d.x); })
    .y(function (d) { return y(d.y); });
var smoothLine = d3.line().curve(d3.curveCardinal)
    .x(function (d) { return x(d.x); })
    .y(function (d) { return y(d.y); });
var lineArea = d3.area()
    .x(function (d) { return x(d.x); })
    .y0(y(0))
    .y1(function (d) { return y(d.y); })
    .curve(d3.curveCardinal);
// -----------------------------------
// Draw the axis
var xAxis = d3.axisBottom().scale(x);
var axisX = chart.append('g').attr('class', 'x axis')
    .attr('transform', 'translate(0, 500)')
    .call(xAxis);
// Draw the grid
chart.append('path').datum([{ x: 0, y: 150 }, { x: 500, y: 150 }])
    .attr('class', 'grid')
    .attr('d', line);
chart.append('path').datum([{ x: 0, y: 300 }, { x: 500, y: 300 }])
    .attr('class', 'grid')
    .attr('d', line);
chart.append('path').datum([{ x: 0, y: 450 }, { x: 500, y: 450 }])
    .attr('class', 'grid')
    .attr('d', line);
chart.append('path').datum([{ x: 50, y: 0 }, { x: 50, y: 500 }])
    .attr('class', 'grid')
    .attr('d', line);
chart.append('path').datum([{ x: 250, y: 0 }, { x: 250, y: 500 }])
    .attr('class', 'grid')
    .attr('d', line);
chart.append('path').datum([{ x: 450, y: 0 }, { x: 450, y: 500 }])
    .attr('class', 'grid')
    .attr('d', line);
// Append the holder for line chart and fill area
var path = chart.append('path');
var areaPath = chart.append('path');
// Main loop
function tick() {
    // Draw new line
    path.datum(all_data)
        .attr('class', 'smoothline')
        .attr('d', smoothLine);
    // Draw new fill area
    areaPath.datum(all_data)
        .attr('class', 'area')
        .attr('d', lineArea);
    // Shift the chart left
    x.domain([globalX - (max - step), globalX]);
    axisX.transition()
        .duration(duration)
        .ease(d3.easeLinear, 2)
        .call(xAxis);
    path.attr('transform', null)
        .transition()
        .duration(duration)
        .ease(d3.easeLinear, 2)
        .attr('transform', 'translate(' + x(globalX - max) + ')')
    areaPath.attr('transform', null)
        .transition()
        .duration(duration)
        .ease(d3.easeLinear, 2)
        .attr('transform', 'translate(' + x(globalX - max) + ')')
        .on('end', tick)
}
tick();


