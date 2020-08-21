const domSelectedPort = document.getElementById("selected-port")
const domSerialPorts = document.getElementById("ports")
const domConnect = document.getElementById("connect")
const domStartSweep = document.getElementById("start-sweep")
const domView = document.getElementById("view")

let isPortOpen = false
let running = false

window.addEventListener("DOMContentLoaded", () => {
    setInterval(() => {
        if (!isPortOpen) {
            window.api.send("get-ports")
        }
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
        isPortOpen = isOpen
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
            domView.innerText = `ch1: ${ch1}, ch2: ${ch2}, ch3: ${ch3}, ch4: ${ch4}, ch5: ${ch5}, ch6: ${ch6}`
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
 */


