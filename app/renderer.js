const domSelectedPort = document.getElementById("selected-port")
const domSerialPorts = document.getElementById("ports")
const domConnect = document.getElementById("connect")
const domStartSweep = document.getElementById("start-sweep")
const domView = document.getElementById("view")

// globa vars

let isPortOpen = false
let running = false
let all_data = []
let status = "STOPPED"
let voltage, current

const voltageLimit = 256
const currentLimit = 1024
const { axisX, xAxis, path, line } = setupPlot(voltageLimit, currentLimit)

// helper functions
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
            drawPlot(all_data, axisX, xAxis, path, line)
        }
        else {
            status = "STOPPED"
            domStartSweep.innerText = "Start"
        }
        showStatusMessage()
    }
})