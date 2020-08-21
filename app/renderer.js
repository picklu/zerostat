const domSelectedPort = document.getElementById("selected-port")
const domSerialPorts = document.getElementById("ports")
const domConnect = document.getElementById("connect")
const domStartSweep = document.getElementById("start-sweep")
const domView = document.getElementById("view")

let isPortOpen = false
let running = false

window.addEventListener("DOMContentLoaded", () => {
    setInterval(() => {
        window.api.send("get-ports")
    }, 5 * 1000)
});

domSelectedPort.addEventListener("submit", (event) => {
    event.preventDefault()
    const port = domSerialPorts.value
    window.api.send("connect-serial", port)
})

domStartSweep.addEventListener("click", () => {
    running = !running
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
        domConnect.disabled = isOpen
        domStartSweep.disabled = !isOpen
        isPortOpen = isOpen
    }
})

window.api.receive("send-data", (raw_data) => {
    const data = raw_data.split(",")
    if (Number(data[0]) >= 0) {
        const [CH1, CH2, ...rest] = data
        domView.innerText = `CH1: ${CH1}, CH2: ${CH2}`
    }
    else {
        domView.innerText = data
    }
})

/**
 *
 *  [sr,halt,mode,pcom,pstart,pend]
 *
 */


