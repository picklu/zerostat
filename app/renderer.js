const domSelectedPort = document.getElementById("selected-port")
const domSerialPorts = document.getElementById("ports")
const domConnect = document.getElementById("connect")
const domStartSweep = document.getElementById("start-sweep")
const domView = document.getElementById("view")

// globa vars
const maxX = 256
const maxY = 1023

let isPortOpen = false
let running = false
let all_data = []
let status = "STOPPED"
let voltage, current

// helper function to display the status
const showStatusMessage = () => {
    voltage = voltage ? voltage : ".."
    current = current ? current : ".."
    domView.innerHTML = `<b>${status}:</b> voltage: ${voltage} V & current: ${current} mA`
}

// get porst once the dom content is loaded
window.addEventListener("DOMContentLoaded", () => {
    showStatusMessage()
    setInterval(() => {
        if (!isPortOpen) {
            if (!domSerialPorts.classList.contains("active")) {
                window.api.send("get-ports")
            }
        }
    }, 5 * 1000)
});

// add/remove class 'active' to/from the selection element
domSerialPorts.addEventListener("mouseenter", (event) => {
    event.target.classList.add("active")
})

domSerialPorts.addEventListener("mouseout", (event) => {
    event.target.classList.remove("active")
})

// call main process to open/close serial
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

// call main process to start/stop potential sweep
domStartSweep.addEventListener("click", () => {
    running = !running
    if (running) {
        all_data = []
        tick()
    }
    domStartSweep.innerText = running ? "Stop" : "Start"
    window.api.send("control-sweep", running)
})

// populate options with ports
window.api.receive("send-ports", (ports) => {
    const items = []
    ports.forEach(port => {
        items.push(`<option value="${port}">${port}</option>`)
    });
    domSerialPorts.innerHTML = items.join("")
})

// update ui on receiving connection status
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

// handle received data
window.api.receive("send-data", (raw_data) => {
    const text_data = raw_data.split(",")
    if (text_data[0] == "ready") {
        domStartSweep.disabled = !isPortOpen
    }
    else {
        const data = text_data.map(d => Number(d))
        // data format [ss,sr,halt,mode,pcom,pstart,pend]
        const [ch1, ch2, ch3, ...rest] = data
        voltage = ch2
        current = ch3
        running = !!ch1 ? true : false
        if (running) {
            status = "RUNNING"
            domStartSweep.innerText = "Stop"
            all_data.push({ x: voltage, y: current })
        }
        else {
            status = "STOPPED"
            domStartSweep.innerText = "Start"
        }
        showStatusMessage()
    }
})

/**
 *
 *  
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

const line = d3.line()
    .x(d => xScale(d.x))
    .y(d => yScale(d.y))
    .curve(d3.curveMonotoneX);

const xAxis = d3.axisBottom().scale(xScale);
const axisX = chart.append('g').attr('class', 'x axis')
    .attr('transform', `translate(0, ${width})`)
    .call(xAxis);

const path = chart.append('path');

function tick() {
    if (running) {
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
}