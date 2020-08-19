const selectedPort = document.getElementById("selected-port")
const showSerialPortsOptions = document.getElementById("show-ports")

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
    showSerialPortsOptions.innerHTML = items.join("")
})