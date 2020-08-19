const getSerialPortsButton = document.getElementById("get-ports")
const showSerialPortsContainer = document.getElementById("show-ports")

getSerialPortsButton.addEventListener("click", (event) => {
    window.api.send("toMain");
})

window.api.receive("fromMain", (ports) => {
    showSerialPortsContainer.innerHTML = ports.join(";")
})