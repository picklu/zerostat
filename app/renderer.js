const domSerialPorts = document.getElementById("ports")
const domConnect = document.getElementById("connect")
const domStartSweep = document.getElementById("start-sweep")
const domView = document.getElementById("view")

// global state object
const state = {
    isPortOpen: false,
    running: false,
    status: "STOPPED",
    voltage: null,
    current: null,
    portList: [],
    all_data: []
}

// as per microcontroller
const DAC_BIT = 8
const ADC_BIT = 10
const OPVOLTS = 5  // operating voltage (V) of teh microcontroller
const REF_DAC = 127 // Refrernce value
const FR = 12120  // feedback resistor in Ohm in the trans-impedance amplifier
const maxDAC = Math.pow(2, DAC_BIT)
const maxADC = Math.pow(2, ADC_BIT)
const vToFR = OPVOLTS / FR // voltage to current conversion factor

// d3js chart
const plotScale = {
    voltMin: -2.5, // in V
    voltMax: 2.5,  // in V
    currMin: -250, // in uA
    currMax: 250,   // in uA
    tickX: 0.5,
    tickY: 50
}
const { axisX, xAxis, path, line } = setupPlot(plotScale) // initial setup of the chart

// helper functions
const showStatusMessage = () => {
    state.voltage = state.voltage ? state.voltage : ".."
    state.current = state.current ? state.current : ".."
    domView.innerHTML = `<b>${state.status}:</b> voltage: ${state.voltage} V & current: ${state.current} uA`
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
    return ((dc - REF_DAC * maxADC / maxDAC) * vToFR / maxADC) * 1e6
}

// get ports once the dom content is loaded
window.addEventListener("DOMContentLoaded", () => {
    showStatusMessage()
    setInterval(() => {
        if (!state.isPortOpen) {
            window.api.send("get-ports")
        }
    }, 2 * 1000)
});

// call main process to open/close serial
domConnect.addEventListener("click", (event) => {
    const port = domSerialPorts.value
    if (state.isPortOpen) {
        window.api.send("disconnect-serial", port)
    }
    else {
        window.api.send("connect-serial", port)
    }
})

// call main process to start/stop potential sweep
domStartSweep.addEventListener("click", () => {
    state.running = !state.running
    if (state.running) {
        state.all_data = []
    }
    domStartSweep.innerText = state.running ? "Stop" : "Start"
    domStartSweep.classList.add(state.running ? "stop-sweep" : "start-sweep")
    domStartSweep.classList.remove(state.running ? "start-sweep" : "stop-sweep")
    window.api.send("control-sweep", state.running)
})

// populate options with ports
window.api.receive("send-ports", (ports) => {
    const items = []
    if (!isEqual(state.portList, ports)) {
        state.portList = [...ports]
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
        state.isPortOpen = true
    }
    else {
        domConnect.innerText = "Connect"
        domConnect.classList.add("connect")
        domConnect.classList.remove("disconnect")
        domStartSweep.innerText = "Start"
        domStartSweep.classList.remove("stop-sweep")
        domStartSweep.classList.add("start-sweep")
        domStartSweep.disabled = true
        state.isPortOpen = false
    }
})

// handle received data
window.api.receive("send-data", (raw_data) => {
    const text_data = raw_data.split(",")
    if (text_data[0] == "ready") {
        state.running = false
        domStartSweep.innerText = "Start"
        domStartSweep.disabled = false
    }
    else {
        const data = text_data.map(d => Number(d))
        // data format [ss,sr,halt,mode,pcom,pstart,pend]
        const [ch1, ch2, ch3, ...rest] = data
        state.running = !!ch1
        state.voltage = digitalToVoltage(ch2)
        state.current = digitalToCurrent(ch3)
        if (state.running) {
            state.status = "RUNNING"
            domStartSweep.innerText = "Stop"
            state.all_data.push({ x: state.voltage, y: state.current })
            drawPlot(state.all_data, axisX, xAxis, path, line)
        }
        else {
            state.status = "STOPPED"
            domStartSweep.innerText = "Start"
        }
        showStatusMessage()
        domStartSweep.classList.add(state.running ? "stop-sweep" : "start-sweep")
        domStartSweep.classList.remove(state.running ? "start-sweep" : "stop-sweep")
    }
})