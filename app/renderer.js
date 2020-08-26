const domSerialPorts = document.getElementById("ports")
const domConnect = document.getElementById("connect")
const domStartSweep = document.getElementById("start-sweep")
const domView = document.getElementById("view")

// globa vars
let isPortOpen = false
let running = false
let status = "STOPPED"
let voltage, current
let portList = []
let all_data = []

const DAC_BIT = 8
const ADC_BIT = 10
const OPVOLTS = 5 // operating voltage (V) of teh microcontroller
const FR = 12120  // feedback resistor in Ohm in the trans-impedance amplifier
const maxDAC = Math.pow(2, DAC_BIT)
const maxADC = Math.pow(2, ADC_BIT)
const plotScale = {
    voltMin: -2.5, // in V
    voltMax: 2.5,  // in V
    currMin: -250, // in uA
    currMax: 250,   // in uA
    tickX: 0.5,
    tickY: 50
}
const vToFR = OPVOLTS / FR // voltage to current conversion factor
const { axisX, xAxis, path, line } = setupPlot(plotScale) // initial setup of the chart

// helper functions
const showStatusMessage = () => {
    voltage = voltage ? voltage : ".."
    current = current ? current : ".."
    domView.innerHTML = `<b>${status}:</b> voltage: ${voltage} V & current: ${current} uA`
}

const isEqual = (a, b) => {
    if (a.length !== b.length) { return false }
    for (let i of a) {
        if (!b.includes(i)) { return false }
    }
    return true
}

const digitalToVoltage = (dv) => {
    return (OPVOLTS / maxDAC) * (maxDAC / 2 - dv)
}

const digitalToCurrent = (dc) => {
    return ((dc - (maxDAC / 2) * maxADC / maxDAC) * vToFR / maxADC) * 1e6
}

// get ports once the dom content is loaded
window.addEventListener("DOMContentLoaded", () => {
    showStatusMessage()
    setInterval(() => {
        if (!isPortOpen) {
            window.api.send("get-ports")
        }
    }, 2 * 1000)
});

// call main process to open/close serial
domConnect.addEventListener("click", (event) => {
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
    }
    domStartSweep.innerText = running ? "Stop" : "Start"
    domStartSweep.classList.add(running ? "stop-sweep" : "start-sweep")
    domStartSweep.classList.remove(running ? "start-sweep" : "stop-sweep")
    window.api.send("control-sweep", running)
})

// populate options with ports
window.api.receive("send-ports", (ports) => {
    const items = []
    if (!isEqual(portList, ports)) {
        portList = [...ports]
        ports.forEach(port => {
            items.push(`<option value="${port}">${port}</option>`)
        });
        domSerialPorts.innerHTML = items.join("")
    }
})

// update ui on receiving connection status
window.api.receive("connection-open", (isOpen) => {
    if (isOpen) {
        domConnect.innerText = "Disconnect"
        domConnect.classList.add("disconnect")
        domConnect.classList.remove("connect")
        domStartSweep.innerText = "Getting Ready"
        isPortOpen = true
    }
    else {
        domConnect.innerText = "Connect"
        domConnect.classList.add("connect")
        domConnect.classList.remove("disconnect")
        domStartSweep.innerText = "Start"
        domStartSweep.classList.remove("stop-sweep")
        domStartSweep.classList.add("start-sweep")
        domStartSweep.disabled = true
        isPortOpen = false
    }
})

// handle received data
window.api.receive("send-data", (raw_data) => {
    const text_data = raw_data.split(",")
    if (text_data[0] == "ready") {
        domStartSweep.innerText = "Start"
        domStartSweep.disabled = false
    }
    else {
        const data = text_data.map(d => Number(d))
        // data format [ss,sr,halt,mode,pcom,pstart,pend]
        const [ch1, ch2, ch3, ...rest] = data
        voltage = digitalToVoltage(ch2)
        current = digitalToCurrent(ch3)
        if (running) {
            status = "RUNNING"
            domStartSweep.innerText = "Stop"
            all_data.push({ x: voltage, y: current })
            drawPlot(all_data, axisX, xAxis, path, line)
        }
        else {
            status = "STOPPED"
            domStartSweep.innerText = "Start"
        }
        showStatusMessage()
        domStartSweep.classList.add(running ? "stop-sweep" : "start-sweep")
        domStartSweep.classList.remove(running ? "start-sweep" : "stop-sweep")
    }
})