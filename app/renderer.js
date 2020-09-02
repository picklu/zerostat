const domSerialPorts = document.getElementById("ports")
const domConnect = document.getElementById("connect")
const domMethod = document.getElementById("method")
const domFormInputs = document.getElementsByClassName("params__form__input")
const domFormParams = document.getElementById("params")
const domSweep = document.getElementById("sweep")
const domView = document.getElementById("view")


// spec of the microcontroller io and amplifier
const DAC_BIT = 8
const ADC_BIT = 10
const OPVOLTS = 5  // operating voltage (V) of the microcontroller
const REF_DAC = 127 // Refrernce DAC value
const FR = 12120  // feedback resistor in Ohm in the trans-impedance amplifier
const maxDAC = Math.pow(2, DAC_BIT)
const maxADC = Math.pow(2, ADC_BIT)
const step = OPVOLTS / maxDAC // potential step
const vToFR = OPVOLTS / FR // voltage to current conversion factor

// global state object
const state = {
    maxDAC: maxDAC,
    refDAC: REF_DAC,
    step: step,
    isPortOpen: false,
    isReady: false,
    isRunning: false,
    status: "STOPPED",
    method: {
        type: "LSV",
        params: {
            // will be populated on submit
        }
    },
    voltage: null,
    current: null,
    portList: [],
    all_data: [],
    overflow: false
}

// helper functions
const showStatusMessage = () => {
    state.voltage = state.voltage ? state.voltage : ".."
    state.current = state.current ? state.current : ".."
    domView.innerHTML = `
        <b class="${state.overflow ? "status overflow" : "status"}">
            ${state.status}:
        </b> voltage: ${state.voltage} V & current: ${state.current} \xB5A`
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
    state.method.type = domMethod.value.toUpperCase()
    Array.from(domFormInputs)
        .forEach((input) => {
            if (!input.classList.contains("common")) {
                if (input.classList.contains("inactive")) {
                    input.classList.add("active")
                    input.classList.remove("inactive")
                }
                else if (input.classList.contains("active")) {
                    input.classList.add("inactive")
                    input.classList.remove("active")
                }
                // else do nothing
            }
            // else do nothing
        })
})

// call main process to start/stop potential sweep
domFormParams.addEventListener("submit", (event) => {
    event.preventDefault()
    state.isRunning = !state.isRunning
    if (state.isRunning) {
        state.all_data = []
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

        // update plot scale
        plotScale.voltMin = Math.min(
            state.method.params.estart || state.method.params.vertex1,
            state.method.params.estop || state.method.params.vertex2,
        )
        plotScale.voltMax = Math.max(
            state.method.params.estart || state.method.params.vertex1,
            state.method.params.estop || state.method.params.vertex2,
        )
    }
    updateUI()
    rescale()
    window.api.send("control-sweep", state)
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
        state.overflow = state.current <= plotScale.currMin ||
            state.current >= plotScale.currMax
        if (state.isRunning) {
            state.status = state.overflow ? "OVERFLOW" : "RUNNING"
            domSweep.innerText = "Stop"
            state.all_data.push({ x: state.voltage, y: state.current })
            drawPlot(state.all_data)
            updateUI()
        }
        else {
            state.status = "STOPPED"
            state.overflow = false
            updateUI()
        }
    }
    showStatusMessage()
})