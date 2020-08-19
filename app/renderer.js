const domSelectedPort = document.getElementById("selected-port")
const domSerialPorts = document.getElementById("ports")

window.addEventListener("DOMContentLoaded", () => {
    setTimeout(() => {
        window.api.send("get-port")
    }, 1000)
});


window.api.receive("send-port", (ports) => {
    const items = []
    ports.forEach(port => {
        items.push(`<option value="${port}">${port}</option>`)
    });
    domSerialPorts.innerHTML = items.join("")
})

domSelectedPort.addEventListener("submit", (event) => {
    event.preventDefault()
    const port = domSerialPorts.value
    window.api.send("connect-serial", port)
})