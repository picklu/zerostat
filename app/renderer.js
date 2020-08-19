const domSelectedPort = document.getElementById("selected-port")
const domSerialPorts = document.getElementById("ports")
const domConnect = document.getElementById("connect")
const domSayHello = document.getElementById("say-hello")
const domView = document.getElementById("view")

let isPortOpen = false

window.addEventListener("DOMContentLoaded", () => {
    setTimeout(() => {
        window.api.send("get-port")
    }, 1000)
});

domSelectedPort.addEventListener("submit", (event) => {
    event.preventDefault()
    const port = domSerialPorts.value
    window.api.send("connect-serial", port)
})

domSayHello.addEventListener("click", () => {
    window.api.send("say-hello")
})

window.api.receive("send-port", (ports) => {
    const items = []
    ports.forEach(port => {
        items.push(`<option value="${port}">${port}</option>`)
    });
    domSerialPorts.innerHTML = items.join("")
})

window.api.receive("connection-open", (isOpen) => {
    if (isOpen) {
        domConnect.disabled = isOpen
        domSayHello.disabled = !isOpen
        isPortOpen = isOpen
    }
})

window.api.receive("response-hello", (data) => {
    domView.innerText = data
})
