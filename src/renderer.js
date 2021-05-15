
const domSerialPorts = document.getElementById("ports")
const domConnect = document.getElementById("connect")
const domMethod = document.getElementById("method")
const domDOMAIN = document.querySelectorAll(".xydomain")
const domFormInputs = document.getElementsByClassName("params__form__input")
const domFormParams = document.getElementById("params")
const domSweep = document.getElementById("sweep")
const domView = document.getElementById("view")
const domChart = document.getElementById("chart")

// spec of the microcontroller io and amplifier
const DAC_BIT = 12
const ADC_BIT = 12
const OUTVOLTS = 2.2    // 0.55 to 2.75
const OPVOLTS = 3.3     // operating voltage (V) of the microcontroller
const REF_DAC = 2048    // Refrernce DAC value
const FR = 12120        // feedback resistor in Ohm in the trans-impedance amplifier
const maxDAC = Math.pow(2, DAC_BIT)
const maxADC = Math.pow(2, ADC_BIT)
const voltRes = OUTVOLTS * 1000 / maxDAC // voltage resolution in mV
const vToFR = OPVOLTS / FR // voltage to current conversion factor

// global state object
const state = {
    deviceModel: "",
    firmwareVersion: "",
    maxDAC: maxDAC,
    refDAC: REF_DAC,
    outVolts: OUTVOLTS,
    opVolts: OPVOLTS,
    voltRes: voltRes,
    isPortOpen: false,
    isReady: false,
    isRunning: false,
    isEquilibrating: false,
    errorMessage: "",
    status: "not ready",
    method: {
        type: "LSV",
        params: {
            // will be populated on submit
        }
    },
    voltage: 0,
    current: 0,
    portList: [],
    data: [],
    overflow: false
}

// helper functions
const showStatusMessage = () => {
    let message = ""
    state.voltage = state.voltage ? state.voltage : 0
    state.current = state.current ? state.current : 0
    if (state.errorMessage !== "") {
        message = `<span class="error bold">ERROR ${state.errorMessage}</span>`
        state.errorMessage = ""
    } else if (state.isPortOpen && !state.isReady) {
        message = "<b class=\"status\">Getting ready ...</b>"
    } else {
        message = `
            <b class="${state.overflow ? "status overflow" : "status"}">
                ${state.status.toUpperCase()}:
            </b> Voltage: ${state.voltage.toFixed(4)} V & Current: ${state.current.toFixed(4)} \xB5A`
    }
    domView.innerHTML = message
}

const updateUI = () => {
    domConnect.innerText = state.isPortOpen
        ? state.isReady
            ? "Disconnect"
            : "Cancel"
        : "Connect"
    domSweep.innerText = state.isPortOpen
        ? state.isReady
            ? state.isRunning ? "Stop" : "Start"
            : "Connecting ..."
        : "Disconnected"

    domConnect.classList.add(state.isPortOpen ? "connected" : "disconnected")
    domConnect.classList.remove(state.isPortOpen ? "disconnected" : "connected")

    domSweep.classList.add(state.isRunning ? "stop-sweep" : "start-sweep")
    domSweep.classList.remove(state.isRunning ? "start-sweep" : "stop-sweep")
    domSweep.disabled = state.isReady && state.isPortOpen ? false : true
}

const isEqual = (a, b) => {
    if (a.length !== b.length) { return false }
    for (let i of a) {
        if (!b.includes(i)) { return false }
    }
    return true
}

const digitalToVoltage = (dv) => {
    return +((REF_DAC - dv) * (OUTVOLTS / maxADC)).toFixed(5)
}

const digitalToCurrent = (dc) => {
    return +(((dc - REF_DAC * maxADC / maxDAC) * vToFR / maxADC) * 1e6).toFixed(5)
}

const updateDomain = (event) => {
    event.preventDefault()
    event.stopPropagation()
    domDOMAIN.forEach(input => {
        const key = input.getAttribute("name")
        const value = input.value
        if (input.parentElement.classList.contains("active")) {
            state.method.params[key] = Number(value)
        }
        else {
            state.method.params[key] = null
        }
    })
    // update plot scale in the chart.js
    domain.voltMax = Math.max(state.method.params.estart, state.method.params.estop)
    domain.currMin = -1 * state.method.params.maxcurrent
    domain.voltMin = Math.min(state.method.params.estart, state.method.params.estop)
    domain.currMax = state.method.params.maxcurrent

    // rescale the plot
    rescale()

    // redraw the plot if not running
    if (!state.isRunning) { drawPlot(state) }
}

// get ports once the dom content is loaded
window.addEventListener("DOMContentLoaded", () => {
    showStatusMessage()

    setInterval(() => { // update port
        if (!state.isPortOpen) {
            window.api.send("ports")
        }
    }, 2 * 1000)

    setInterval(() => {
        if (state.isRunning && state.data.length) {
            drawPlot(state)
        }
    }, 50)
})

// populate options with ports
window.api.receive("ports", (ports) => {
    const items = []
    if (ports.length === 0) { ports.push("COMX") }
    if (!isEqual(state.portList, ports)) {
        state.portList = [...ports]
        ports.forEach(port => {
            items.push(`<option value="${port}">${port}</option>`)
        });

        domSerialPorts.innerHTML = items.join("")
    }
})

// call main process to open/close serial
domConnect.addEventListener("click", (event) => {
    const port = domSerialPorts.value
    state.isReady = false
    state.isRunning = false
    window.api.send("connection", port)
})

// update ui on receiving connection status
window.api.receive("connection", (isPortOpen, error) => {
    state.voltage = isPortOpen ? state.voltage : 0
    state.current = isPortOpen ? state.current : 0
    state.isPortOpen = isPortOpen
    state.errorMessage = error
    state.status = !error ? "disconnected" : "error"
    showStatusMessage()
    updateUI()
})

// Update input param fileds according to the selected method
domMethod.addEventListener("change", (event) => {
    const methodType = domMethod.value.toUpperCase()
    const domEStart = document.getElementById("estart")
    const domEStop = document.getElementById("estop")
    const domNCycles = document.getElementById("ncycles")
    state.method.type = methodType
    switch (methodType) {
        case "CV":
            domEStart.parentElement.firstElementChild.innerText = "Vertex1 (V)"
            domEStop.parentElement.firstElementChild.innerText = "Vertex2 (V)"
            domNCycles.parentElement.classList.remove("inactive")
            domNCycles.parentElement.classList.add("active")
            break
        case "LSV":
            domEStart.parentElement.firstElementChild.innerText = "E Start (V)"
            domEStop.parentElement.firstElementChild.innerText = "E Stop (V)"
            domNCycles.parentElement.classList.remove("active")
            domNCycles.parentElement.classList.add("inactive")
            break;
    }
})

// Update plot domain
domDOMAIN.forEach(input => {
    input.addEventListener("change", updateDomain)
})

// call main process to start/stop potential sweep
domFormParams.addEventListener("submit", (event) => {
    event.preventDefault()
    state.isRunning = !state.isRunning
    if (state.isRunning) {
        state.data = []
        Array.from(event.target).forEach(input => {
            if (input.tagName === "INPUT") {
                const key = input.getAttribute("name")
                const value = input.value
                if (input.parentElement.classList.contains("active")) {
                    state.method.params[key] = Number(value)
                }
                else {
                    state.method.params[key] = null
                }
            }
            // else do nothing
        })
    }
    updateUI()
    window.api.send("sweep", state)
})

// handle received data
window.api.receive("data", (raw_data) => {
    const text_data = raw_data.split(",")
    if (text_data[2] == "READY") {
        state.deviceModel = text_data[0]
        state.firmwareVersion = text_data[1]
        state.isReady = true
        state.isRunning = false
        state.status = "ready"
        updateUI()
    }
    else {
        const data = text_data.map(d => Number(d))
        // data format [ss,sr,halt,mode,pcom,pstart,pend,eqltime

        const [ch1, ch2, ch3, ch4, ch5, eqltime] = data
        state.isRunning = ch1 === 1 || ch1 === -1
        state.isEquilibrating = ch1 === -1
        state.voltage = digitalToVoltage(ch2)
        state.current = digitalToCurrent(ch3)
        state.overflow = state.current <= domain.currMin ||
            state.current >= domain.currMax
        state.status = state.overflow ? "overflow" : "running"

        if (state.isRunning && !state.isEquilibrating) {
            state.data.push({ x: state.voltage, y: state.current })
        } else if (state.isRunning && state.isEquilibrating) {
            state.status = `equilibrating [${eqltime}]`
            state.overflow = false
        }
        else {
            state.status = "ready"
            state.overflow = false
        }
    }
    updateUI()
    showStatusMessage()
})