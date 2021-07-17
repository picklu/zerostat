const domSerialPorts = document.getElementById("ports")
const domConnect = document.getElementById("connect")
const domMethod = document.getElementById("method")
const domDOMAIN = document.querySelectorAll(".xydomain")
const domFormParams = document.getElementById("params")
const domSweep = document.getElementById("sweep")
const domStatusMessage = document.querySelector(".status-message")
const domFilePathBase = document.querySelector(".file-path__base")
const domFilePathTail = document.querySelector(".file-path__text")
const domTableBody = document.querySelector(".table__body")
const domMetaData = document.querySelector(".meta-data")
const domMainData = document.querySelector(".main-data")
const domLoadData = document.getElementById("load-data")
const domVoltageLimitInputs = document.querySelectorAll(".voltage-limit")

// spec of the microcontroller io and amplifier
const DAC_BIT = 12
const ADC_BIT = 12
const OUTVOLTS = 2.2    // 0.55 to 2.75
const OPVOLTS = 3.3     // operating voltage (V) of the microcontroller
const REF_DAC = 2048    // Refrernce DAC value
const FR = 12120        // feedback resistor in Ohm in the trans-impedance amplifier
const maxDAC = Math.pow(2, DAC_BIT)
const maxADC = Math.pow(2, ADC_BIT)
const voltRes = OUTVOLTS * 1000 / maxDAC // voltage resolution in mV
const vToFR = OPVOLTS / FR // voltage to current conversion factor

// global state object
const state = {
    deviceModel: "",
    firmwareVersion: "",
    maxDAC: maxDAC,
    refDAC: REF_DAC,
    outVolts: OUTVOLTS,
    opVolts: OPVOLTS,
    voltRes: voltRes,
    isPortOpen: false,
    isReady: false,
    isRunning: false,
    isEquilibrating: false,
    isDataReady: false,
    isWritingData: false,
    errorMessage: "",
    status: "not ready",
    method: {
        type: "LSV",
        params: {
            // will be populated on submit
        }
    },
    voltage: 0,
    current: 0,
    portList: [],
    data: [],
    overflow: false,
}

// helper functions
const showStatusMessage = () => {
    let message = ""
    state.voltage = state.voltage ? state.voltage : 0
    state.current = state.current ? state.current : 0
    if (state.errorMessage !== "") {
        message = `<span class="error bold">ERROR ${state.errorMessage}</span>`
        state.errorMessage = ""
    } else if (state.isPortOpen && !state.isReady) {
        message = "<b class=\"status\">Getting ready ...</b>"
    } else {
        message = `
            <b class="${state.overflow ? "status overflow" : "status"}">
                ${state.status.toUpperCase()}:
            </b> Voltage: ${state.voltage.toFixed(4)} V & Current: ${state.current.toFixed(4)} \xB5A`
    }
    domStatusMessage.innerHTML = message
}

const updateUI = () => {
    domConnect.innerText = state.isPortOpen
        ? state.isReady
            ? "Disconnect"
            : "Cancel"
        : "Connect"
    domSweep.innerText = state.isPortOpen
        ? state.isReady
            ? state.isRunning ? "Stop" : "Start"
            : "Connecting ..."
        : "Disconnected"

    domConnect.classList.add(state.isPortOpen ? "connected" : "disconnected")
    domConnect.classList.remove(state.isPortOpen ? "disconnected" : "connected")

    domSweep.classList.add(state.isRunning ? "stop-sweep" : "start-sweep")
    domSweep.classList.remove(state.isRunning ? "start-sweep" : "stop-sweep")
    domSweep.disabled = state.isReady && state.isPortOpen ? false : true
}

const isEqual = (a, b) => {
    if (a.length !== b.length) { return false }
    for (let i of a) {
        if (!b.includes(i)) { return false }
    }
    return true
}

const digitalToVoltage = (dv) => {
    return +((REF_DAC - dv) * (OUTVOLTS / maxADC)).toFixed(5)
}

const digitalToCurrent = (dc) => {
    return +(((dc - REF_DAC * maxADC / maxDAC) * vToFR / maxADC) * 1e6).toFixed(5)
}

const updateDomain = (event) => {
    event.preventDefault()
    event.stopPropagation()
    domDOMAIN.forEach(input => {
        const key = input.getAttribute("name")
        if (input.parentElement.classList.contains("active")) {
            state.method.params[key] = +input.value
        }
        else {
            state.method.params[key] = null
        }
    })
    // update plot scale in the chart.js
    domain.voltMax = Math.max(state.method.params.estart, state.method.params.estop)
    domain.currMin = -1 * state.method.params.maxcurrent
    domain.voltMin = Math.min(state.method.params.estart, state.method.params.estop)
    domain.currMax = state.method.params.maxcurrent

    // rescale the plot
    rescale()

    // redraw the plot if not running
    if (!state.isRunning) { draw(state) }
}


const listFilesInTable = (files, folder) => {
    const childNodes = [...document.querySelectorAll(".table__body>.table__row")]
    for (let i = 0; i < childNodes.length; i++) {
        if (domTableBody.hasChildNodes(childNodes[i])) {
            domTableBody.removeChild(childNodes[i])
        }
    }

    files.forEach((file, idx) => {
        const rowNode = document.createElement("div")
        const idxNode = document.createElement("div")
        const fileDateNode = document.createElement("div")
        const fileNameNode = document.createElement("div")
        const regX = /^(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})/
        const match = regX.exec(file)
        const [__, year, month, day, hour, minute, second] = match
        const date = new Date(year, month - 1, day, hour, minute, second)

        rowNode.setAttribute("class", "table__row")
        idxNode.setAttribute("class", "idx")
        fileDateNode.setAttribute("class", "file-date")
        fileNameNode.setAttribute("class", "file-name")
        fileDateNode.setAttribute("data", folder)
        fileNameNode.setAttribute("data", file)
        idxNode.appendChild(document.createTextNode(`${idx + 1}`))
        fileDateNode.appendChild(document.createTextNode(date.toLocaleString()))
        fileNameNode.appendChild(document.createTextNode(file))
        rowNode.appendChild(idxNode)
        rowNode.appendChild(fileDateNode)
        rowNode.appendChild(fileNameNode)
        if (idx == files.length - 1) { rowNode.classList.add('active-row') }
        domTableBody.prepend(rowNode)
    })
}// end of helper function


// get ports once the dom content is loaded
window.addEventListener("DOMContentLoaded", () => {
    showStatusMessage()

    window.api.send("listFiles")

    setInterval(() => { // update port
        if (!state.isPortOpen) {
            window.api.send("ports")
        }
    }, 2 * 1000)

    setInterval(() => {
        if (state.isRunning) {
            draw(state)
        }
        else {
            if (!state.isWritingData && !state.isRunning && state.isDataReady) {
                state.isWritingData = true
                state.isDataReady = false
                window.api.send("save", state)
                domConnect.classList.remove("btn-inactive")
                domLoadData.classList.remove("btn-inactive")
            }
        }
    }, 50)
})

// populate options with ports
window.api.receive("ports", (ports) => {
    const items = []
    if (ports.length === 0) { ports.push("COMX") }
    if (!isEqual(state.portList, ports)) {
        state.portList = [...ports]
        ports.forEach(port => {
            items.push(`<option value="${port}">${port}</option>`)
        });

        domSerialPorts.innerHTML = items.join("")
    }
})

// Update input values of the voltage limits  in two decimal points
domVoltageLimitInputs.forEach(input => {
    input.addEventListener("input", () => {
        input.value = (+input.value).toFixed(2)
    })
})

// call main process to open/close serial
domConnect.addEventListener("click", (event) => {
    if (!state.isRunning) {
        const port = domSerialPorts.value
        state.isReady = false
        window.api.send("connection", port)
    }
})

// update ui on receiving connection status
window.api.receive("connection", (isPortOpen, error) => {
    state.voltage = isPortOpen ? state.voltage : 0
    state.current = isPortOpen ? state.current : 0
    state.isPortOpen = isPortOpen
    state.errorMessage = error
    state.status = !error ? "disconnected" : "error"
    showStatusMessage()
    updateUI()
})

// Update input param fileds according to the selected method
domMethod.addEventListener("change", (event) => {
    const methodType = domMethod.value.toUpperCase()
    const domEStart = document.getElementById("estart")
    const domEStop = document.getElementById("estop")
    const domNCycles = document.getElementById("ncycles")
    state.method.type = methodType
    switch (methodType) {
        case "CV":
            domEStart.parentElement.firstElementChild.innerText = "Vertex1 (V)"
            domEStop.parentElement.firstElementChild.innerText = "Vertex2 (V)"
            domNCycles.parentElement.classList.remove("inactive")
            domNCycles.parentElement.classList.add("active")
            break
        case "LSV":
            domEStart.parentElement.firstElementChild.innerText = "E Start (V)"
            domEStop.parentElement.firstElementChild.innerText = "E Stop (V)"
            domNCycles.parentElement.classList.remove("active")
            domNCycles.parentElement.classList.add("inactive")
            break;
    }
})

// Add updateDomain as change event listener to all the form fields
domDOMAIN.forEach(input => {
    input.addEventListener("change", updateDomain)
})

// call main process to start/stop potential sweep
domFormParams.addEventListener("submit", (event) => {
    event.preventDefault()
    state.isRunning = !state.isRunning
    if (state.isRunning) {

        domConnect.classList.add("btn-inactive")
        domLoadData.classList.add("btn-inactive")


        state.data = []
        Array.from(event.target).forEach(input => {
            if (input.tagName === "INPUT") {
                const key = input.getAttribute("name")
                const value = input.value
                if (input.parentElement.classList.contains("active")) {
                    state.method.params[key] = Number(value)
                }
                else {
                    state.method.params[key] = null
                }
            }
            // else do nothing
        })
    } else {
        domConnect.classList.remove("btn-inactive")
        domLoadData.classList.remove("btn-inactive")
    }
    window.api.send("sweep", state)
})


// Handle click event on base file path
domFilePathBase.addEventListener("click", (event) => {
    window.api.send("path")
})

// Handle click event on data table 
domTableBody.addEventListener("click", (event) => {
    const className = event.target.classList.value
    event.stopPropagation()

    if (!state.isRunning && (className === 'idx' || className === 'file-date' || className === 'file-name')) {
        const domTableRow = event.target.parentElement
        const domFileDate = domTableRow.querySelector('.file-date')
        const domFileName = domTableRow.querySelector('.file-name')
        const folder = domFileDate.getAttribute('data')
        const fileName = domFileName.getAttribute('data')
        domFilePathBase.setAttribute('data', folder)
        domFilePathTail.setAttribute('data', fileName)
        domFilePathBase.value = folder
        domFilePathTail.value = fileName
        domTableRow.parentElement.querySelectorAll('.table__row').forEach(row => {
            row.classList.remove('active-row')
        })
        domTableRow.classList.add('active-row')
        window.api.send('load', { folder, fileName })
    }
})

// Handle click event on Open File
domLoadData.addEventListener('click', () => {
    if (!state.isRunning) {
        const filePathBase = domFilePathBase.getAttribute('data')
        const fileName = domFilePathTail.getAttribute('data')
        console.log({ filePathBase, fileName })
        window.api.send('open', { filePathBase, fileName })
    }
})

// On receiving path update file path
window.api.receive("path", ({ error, folderPath }) => {
    if (error) {
        console.log(error)
    }
    else if (folderPath) {
        domFilePathBase.value = folderPath
    }
    else {
        console.log("No folder was selected!")
    }
})

// On receiving data act accordingly
window.api.receive('data', (raw_data) => {
    const text_data = raw_data.split(",")
    if (text_data[2] == 'READY') {
        state.deviceModel = text_data[0]
        state.firmwareVersion = text_data[1]
        state.isReady = true
        state.isRunning = false
        state.status = "ready"
    }
    else {
        const data = text_data.map(d => Number(d))
        // data format [ss,sr,halt,mode,pcom,pstart,pend,eqltime
        const [ch1, ch2, ch3, ch4, ch5, eqltime] = data
        state.isRunning = ch1 === 1 || ch1 === -1
        state.isEquilibrating = ch1 === -1
        state.voltage = digitalToVoltage(ch2)
        state.current = digitalToCurrent(ch3)
        state.overflow = state.current <= domain.currMin ||
            state.current >= domain.currMax
        state.status = state.overflow ? "overflow" : "running"
        if (state.isRunning) { // sweeping or equilibrating (ch1 = 1 or -1)
            if (state.isEquilibrating) {
                state.status = `equilibrating [${eqltime}]`
            } else {
                if (!state.isDataReady) {
                    state.isDataReady = true
                    state.data = []
                }
                state.data.push({ x: state.voltage, y: state.current })
            }
        }
        else { // ch1 must be 0 that is not running
            state.status = "ready"
        }
    }
    updateUI()
    showStatusMessage()
})

// On saving data query for list of files
window.api.receive("saved", ({ filePath, error }) => {
    if (filePath) {
        state.isWritingData = false
        window.api.send("listFiles")
    } else if (error) {
        console.log(error)
    } else {
        console.log("Something went wrong in saving file!")
    }
})

// On receiving list of files update dom
window.api.receive("listFiles", ({ files, folder, error }) => {
    if (error) {
        console.log(error)
    }
    else if (folder) {
        domFilePathBase.value = folder
        domFilePathBase.setAttribute("data", folder)

        if (files && files.length) {
            const fileName = [...files].pop() || "..." // Name of the last file
            domFilePathTail.setAttribute('data', fileName)
            domFilePathTail.value = fileName
            listFilesInTable(files, folder)
            window.api.send("load", { folder, fileName })
        }
        else {
            console.log("There were no files found in the selected folder!")
        }
    }
    else {
        console.log("The data folder was not found!")
    }
})

// On receiving data of the selected file
window.api.receive("loaded", ({ error, mainDataText, mainDataObj, metaData }) => {
    if (error) {
        console.log(error)
    }
    else if (mainDataText && mainDataObj && metaData) {
        state.data = mainDataObj
        draw(state)
        domMainData.innerText = mainDataText
        domMetaData.innerText = metaData
    }
    else {
        console.log("Something went wrong!")
    }
})