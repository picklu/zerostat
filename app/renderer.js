const getSerialPortsButton = document.getElementById("get-ports")
const showSerialPortsContainer = document.getElementById("show-ports")

getSerialPortsButton.addEventListener("click", (event) => {
    window.api.send("toMain");
})

window.api.receive("fromMain", (ports) => {
    const listItems = []
    ports.forEach(port => {
        listItems.push(`<li>${port}</li>`)
    });
    showSerialPortsContainer.innerHTML = listItems.join("")
})