const getSerialPortsButton = document.getElementById("get-ports")
const showSerialPortsOptions = document.getElementById("show-ports")

window.addEventListener("DOMContentLoaded", () => {
    setTimeout(() => {
        window.api.send("toMain")
    }, 1000)
});


window.api.receive("fromMain", (ports) => {
    const items = []
    ports.forEach(port => {
        items.push(`<option value="${port}">${port}</option>`)
    });
    showSerialPortsOptions.innerHTML = items.join("")
})