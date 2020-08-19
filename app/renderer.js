const getSerialPortsButton = document.getElementById("get-ports")
const showSerialPortsContainer = document.getElementById("show-ports")

getSerialPortsButton.addEventListener("click", (event) => {
    window.api.send("toMain");
})

window.api.receive("fromMain", (data) => {
    const ports = []
    data.forEach(element => {
        ports.push(element.path)
    });
    showSerialPortsContainer.innerHTML = ports.join(";")
})