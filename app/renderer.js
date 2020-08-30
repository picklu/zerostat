const domSerialPorts = document.getElementById("ports")
const domConnect = document.getElementById("connect")
const domMethod = document.getElementById("method")
const domFormInputs = document.getElementsByClassName("params__form__input")
const domFormParams = document.getElementById("params")
const domSweep = document.getElementById("sweep")
const domView = document.getElementById("view")

// global state object
const state = {
    isPortOpen: false,
    isReady: false,
    isRunning: false,
    status: "STOPPED",
    method: "LSV",
    voltage: null,
    current: null,
    portList: [],
    all_data: []
}

// spec of the microcontroller io and amplifier
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
    currMax: 250,  // in uA
    tickX: 0.5,
    tickY: 50
}
const { path, line } = setupPlot(plotScale) // initial setup of the chart

// helper functions
const showStatusMessage = () => {
    state.voltage = state.voltage ? state.voltage : ".."
    state.current = state.current ? state.current : ".."
    domView.innerHTML = `<b>${state.status}:</b> voltage: ${state.voltage} V & current: ${state.current} \xB5A`
}

const updateUI = () => {
    domConnect.innerText = state.isPortOpen ? "Disconnect" : "Connect"
    domConnect.classList.add(state.isPortOpen ? "connected" : "disconnected")
    domConnect.classList.remove(state.isPortOpen ? "disconnected" : "connected")

    domSweep.classList.add(state.isRunning ? "stop-sweep" : "start-sweep")
    domSweep.classList.remove(state.isRunning ? "start-sweep" : "stop-sweep")
    domSweep.disabled = state.isReady && state.isPortOpen ? false : true
    domSweep.innerText = state.isPortOpen
        ? state.isReady
            ? state.isRunning ? "Stop" : "Start"
            : "Getting Ready"
        : "Disconnected"
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
    const channel = state.isPortOpen ? "disconnect-serial" : "connect-serial"
    state.isReady = false
    state.isRunning = false
    window.api.send(channel, port)
})

domMethod.addEventListener("change", (event) => {
    state.method = domMethod.value.toUpperCase()
    Array.from(domFormInputs)
        .forEach((input) => {
            if (input.classList.contains("inactive")) {
                input.classList.add("active")
                input.classList.remove("inactive")
            }
            else if (input.classList.contains("active")) {
                input.classList.add("inactive")
                input.classList.remove("active")
            }
            // else do nothing
        })
})

// call main process to start/stop potential sweep
domFormParams.addEventListener("submit", (event) => {
    state.isRunning = !state.isRunning
    updateUI()
    if (state.isRunning) { state.all_data = [] }
    window.api.send("control-sweep", state.isRunning)
    const formData = new FormData(event.target)
    console.log(formData)
    event.preventDefault()
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
window.api.receive("connection-open", (isPortOpen) => {
    state.isPortOpen = isPortOpen
    updateUI()
})

// handle received data
window.api.receive("send-data", (raw_data) => {
    const text_data = raw_data.split(",")
    if (text_data[0] == "ready") {
        state.isReady = true
        state.isRunning = false
        updateUI()
    }
    else {
        const data = text_data.map(d => Number(d))
        // data format [ss,sr,halt,mode,pcom,pstart,pend]
        const [ch1, ch2, ch3, ...rest] = data
        state.isRunning = !!ch1
        state.voltage = digitalToVoltage(ch2)
        state.current = digitalToCurrent(ch3)
        if (state.isRunning) {
            state.status = "RUNNING"
            domSweep.innerText = "Stop"
            state.all_data.push({ x: state.voltage, y: state.current })
            drawPlot(state.all_data, path, line)
            updateUI()
        }
        else {
            state.status = "STOPPED"
            updateUI()
        }
    }
    showStatusMessage()
})