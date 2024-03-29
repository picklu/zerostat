const domSerialPorts = document.getElementById('ports')
const domConnect = document.getElementById('connect')
const domMethod = document.getElementById('method')
const domDOMAIN = document.querySelectorAll('.xydomain')
const domFormParams = document.getElementById('params')
const domSweep = document.getElementById('sweep')
const domStatusMessage = document.querySelector('.status-message')
const domFolderPath = document.querySelector('.folder-text')
const domFileName = document.querySelector('.file-name')
const domTableBody = document.querySelector('.table__body')
const domMetaData = document.querySelector('.meta-data')
const domMainData = document.querySelector('.main-data')
const domLoadData = document.getElementById('load-data')
const domMaxCurrent = document.getElementById('maxcurrent')
const domEStart = document.getElementById('estart')
const domEStop = document.getElementById('estop')
const domEStep = document.getElementById('estep')
const domScanRate = document.getElementById('scanrate')
const domNCycles = document.getElementById('ncycles')
const domEquilibrationTime = document.getElementById('equilibrationtime')
const domVoltageLimitInputs = document.querySelectorAll('.voltage-limit')

// Specification of the microcontroller io and amplifier
const DAC_BIT = 12
const ADC_BIT = 12
const OUTVOLTS = 2.2        // 0.55 to 2.75
const OPVOLTS = 3.3         // operating voltage (V) of the microcontroller
const REF_DAC = 2048        // Refrernce DAC value
const FB_RESISTOR = 12120    // feedback resistor in Ohm in the trans-impedance amplifier
const maxDAC = Math.pow(2, DAC_BIT)
const maxADC = Math.pow(2, ADC_BIT)
const voltRes = OUTVOLTS * 1000 / maxDAC // voltage resolution in mV

// global state object
const state = {
    deviceModel: '',
    firmwareVersion: '',
    maxDAC: maxDAC,
    refDAC: REF_DAC,
    outVolts: OUTVOLTS,
    opVolts: OPVOLTS,
    voltRes: voltRes,
    fbResistor: FB_RESISTOR,
    isPortOpen: false,
    isReady: false,
    isRunning: false,
    isEquilibrating: false,
    isDataReady: false,
    isWritingData: false,
    errorMessage: '',
    status: 'not ready',
    method: {
        type: 'LSV',
        params: {
            // will be populated on submit
        }
    },
    voltage: 0,
    current: 0,
    portList: [],
    data: [],
    dataFiles: {},
    overflow: false,
}

// helper functions
// Update/show status message
const showStatusMessage = () => {
    let message = ''
    state.voltage = state.voltage ? state.voltage : 0
    state.current = state.current ? state.current : 0
    if (state.errorMessage !== '') {
        message = `<span class='error bold'>ERROR ${state.errorMessage}</span>`
        state.errorMessage = ''
    } else if (state.isPortOpen && !state.isReady) {
        message = '<b class=\'status\'>Getting ready ...</b>'
    } else {
        message = `
            <b class='${state.overflow ? 'status overflow' : 'status'}'>
                ${state.status.toUpperCase()}:
            </b> Voltage: ${state.voltage.toFixed(4)} V & Current: ${state.current.toFixed(4)} \xB5A`
    }
    domStatusMessage.innerHTML = message
}

// Change option and dispatch change event
const changeOption = (dom, value) => {
    const change = new Event('change')
    value = dom.className.includes('method') ? value.toLowerCase() : value.toString()
    Array.from(dom.options).forEach((opt, idx) => {
        if (opt.value === value) {
            dom.options[idx].selected = true
            dom.dispatchEvent(change)
        }
    })
}

// Change input and dispatch change event
const changeInput = (dom, value) => {
    const change = new Event('change')
    dom.value = value
    dom.dispatchEvent(change)
}

// Change options and inputs
const updateParams = (params) => {
    const {
        methodType,
        currMax,
        estart,
        estop,
        estep,
        scanrate,
        ncycles,
        equilibrationTime,
    } = params

    changeOption(domMethod, methodType)
    changeOption(domMaxCurrent, currMax)
    changeInput(domEStart, estart)
    changeInput(domEStop, estop)
    changeInput(domEStep, estep)
    changeInput(domScanRate, scanrate)
    changeInput(domNCycles, ncycles)
    changeInput(domEquilibrationTime, equilibrationTime)
}

// Update state of the connect and sweep buttons
const updateUI = () => {
    domConnect.innerText = state.isPortOpen
        ? state.isReady
            ? 'Disconnect'
            : 'Cancel'
        : 'Connect'
    domSweep.innerText = state.isPortOpen
        ? state.isReady
            ? state.isRunning ? 'Stop' : 'Start'
            : 'Connecting ...'
        : 'Disconnected'

    domConnect.classList.add(state.isPortOpen ? 'connected' : 'disconnected')
    domConnect.classList.remove(state.isPortOpen ? 'disconnected' : 'connected')

    domSweep.classList.add(state.isRunning ? 'stop-sweep' : 'start-sweep')
    domSweep.classList.remove(state.isRunning ? 'start-sweep' : 'stop-sweep')
    domSweep.disabled = state.isReady && state.isPortOpen ? false : true
}

// Convert ADC output for voltage to voltage
const digitalToVoltage = (dv) => {
    return +((REF_DAC - dv) * (OUTVOLTS / maxADC)).toFixed(5)
}

// Convert ADC output for current to current
const digitalToCurrent = (dc) => {
    const factorVToC = OPVOLTS / state.fbResistor // voltage to current conversion factor
    return +(((dc - REF_DAC * maxADC / maxDAC) * factorVToC / maxADC) * 1e6).toFixed(5)
}

// Update current-voltage (xy domain for chart)
const updateDomain = (event) => {
    event.preventDefault()
    event.stopPropagation()
    domDOMAIN.forEach(input => {
        const key = input.getAttribute('name')
        if (input.parentElement.classList.contains('active')) {
            state.method.params[key] = +input.value
        }
        else {
            state.method.params[key] = null
        }
    })
    // update plot scale in the chart.js
    domain.voltMax = Math.max(state.method.params.estart, state.method.params.estop)
    domain.voltMin = Math.min(state.method.params.estart, state.method.params.estop)
    domain.currMin = -1 * state.method.params.maxcurrent
    domain.currMax = state.method.params.maxcurrent

    // rescale the plot
    rescale()

    // redraw the plot if not running
    if (!state.isRunning) { draw(state) }
}

// Remove all childe nodes 
const removeAllChildNodes = (parent) => {
    while (parent.firstChild) {
        parent.removeChild(parent.firstChild);
    }
}

// Create row node for data file
const createRowNode = (index, folder, fileName) => {
    const rowNode = document.createElement('div')
    const idxNode = document.createElement('div')
    const fileDateNode = document.createElement('div')
    const fileNameNode = document.createElement('div')
    const regX = /^(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})/
    const match = regX.exec(fileName)
    const [__, year, month, day, hour, minute, second] = match
    const date = new Date(year, month - 1, day, hour, minute, second)

    rowNode.setAttribute('class', 'table__row')
    idxNode.setAttribute('class', 'idx')
    fileDateNode.setAttribute('class', 'file-date')
    fileNameNode.setAttribute('class', 'file-name')
    fileDateNode.setAttribute('data', folder)
    fileNameNode.setAttribute('data', fileName)
    idxNode.appendChild(document.createTextNode(`${index}`))
    fileDateNode.appendChild(document.createTextNode(date.toLocaleString()))
    fileNameNode.appendChild(document.createTextNode(fileName))
    rowNode.appendChild(idxNode)
    rowNode.appendChild(fileDateNode)
    rowNode.appendChild(fileNameNode)

    return rowNode
}

// Load the folder/fileName data file
const setActiveData = (folder, fileName) => {
    const childNodes = [...document.querySelectorAll('.table__body>.table__row')]
    if (childNodes.length) {
        const topRowNode = childNodes[0]
        topRowNode.classList.add('active-row')
        domFolderPath.setAttribute('data', folder)
        domFolderPath.value = folder
        domFileName.setAttribute('data', fileName)
        domFileName.value = fileName
        window.api.send('file:load', { folder, fileName })
    }
}

// Render table with all data files
const listAllFilesInTable = (dataFiles, loadData = true) => {
    const folders = Object.keys(dataFiles)
    const totalFiles = Object.values(dataFiles).flat().length
    let count = 0

    removeAllChildNodes(domTableBody)

    folders.forEach((folder) => {
        let files = dataFiles[folder]
        files.forEach((file) => {
            const rowNode = createRowNode(++count, folder, file)
            domTableBody.prepend(rowNode)

            if (loadData && count === totalFiles) {
                setActiveData(folder, file)
            }
        })
    })
}

// Update table with new data file
const updateDataTable = (folder, fileName) => {

    if (state.dataFiles[folder]) {
        const fileIndex = state.dataFiles[folder].indexOf(fileName)
        if (fileIndex != -1) {
            delete state.dataFiles[folder][fileIndex]
            removeAllChildNodes(domTableBody)
            listAllFilesInTable(state.dataFiles, false)
        }
    } else {
        state.dataFiles[folder] = []
    }

    // Remove class 'active-row' from the row
    const childNodes = [...document.querySelectorAll('.table__body>.table__row')]
    childNodes.forEach(node => {
        if (node.classList.contains('active-row')) {
            node.classList.remove('active-row')
        }
    })

    const index = Object.values(state.dataFiles).flat().length + 1
    const rowNode = createRowNode(index, folder, fileName)
    domTableBody.prepend(rowNode)
    state.dataFiles[folder].unshift(fileName)
    setActiveData(folder, fileName)
    window.api.send('file:load', { folder, fileName })
} // end of helper functions


// get ports once the dom content is loaded
window.addEventListener('DOMContentLoaded', () => {
    showStatusMessage()

    window.api.send('file:list')

    setInterval(() => { // update port
        if (!state.isPortOpen) {
            window.api.send('serial:ports')
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
                window.api.send('file:save', state)
                domConnect.classList.remove('btn-inactive')
                domLoadData.classList.remove('btn-inactive')
            }
        }
    }, 50)
})


// Update input values of the voltage limits  in two decimal points
domVoltageLimitInputs.forEach(input => {
    input.addEventListener('change', () => {
        input.value = (+input.value).toFixed(2)
    })
})

// call main process to open/close serial
domConnect.addEventListener('click', (event) => {
    if (!state.isRunning) {
        const port = domSerialPorts.value
        state.isReady = false
        window.api.send('serial:connection', port)
    }
})

// Update input param fileds according to the selected method
domMethod.addEventListener('change', (event) => {
    const methodType = domMethod.value.toUpperCase()
    state.method.params.ncycles = domNCycles.value
    state.method.type = methodType
    switch (methodType) {
        case 'CV':
            domEStart.parentElement.firstElementChild.innerText = 'Vertex1 (V)'
            domEStop.parentElement.firstElementChild.innerText = 'Vertex2 (V)'
            domNCycles.parentElement.classList.remove('inactive')
            domNCycles.parentElement.classList.add('active')
            break
        case 'LSV':
            domEStart.parentElement.firstElementChild.innerText = 'E Start (V)'
            domEStop.parentElement.firstElementChild.innerText = 'E Stop (V)'
            domNCycles.parentElement.classList.remove('active')
            domNCycles.parentElement.classList.add('inactive')
            break
    }
})

// Add updateDomain as change event listener to all the form fields
domDOMAIN.forEach(input => {
    input.addEventListener('change', updateDomain)
})

// call main process to start/stop potential sweep
domFormParams.addEventListener('submit', (event) => {
    event.preventDefault()
    state.isRunning = !state.isRunning

    if (state.isRunning) {

        domConnect.classList.add('btn-inactive')
        domLoadData.classList.add('btn-inactive')
        state.data = []


        Array.from(new FormData(event.target)).forEach(kv => {
            const key = kv[0]
            const value = kv[1]
            state.method.params[key] = key === 'method' ? value : Number(value)
        })

        // if maxCurrent is 300 uA then change the feedback resistor accordingly
        if (state.method.params.maxcurrent === 125) {
            state.fbResistor = FB_RESISTOR
        }
        else {
            state.fbResistor = FB_RESISTOR / 2
        }
    } else {
        domConnect.classList.remove('btn-inactive')
        domLoadData.classList.remove('btn-inactive')
    }
    window.api.send('current-voltage:sweep', state)
})

// Handle click event on base file path
domFolderPath.addEventListener('click', (event) => {
    window.api.send('file:path', isFolder = true)
})

// Handle click event on data table 
domTableBody.addEventListener('click', (event) => {
    const className = event.target.classList.value
    event.stopPropagation()

    if (!state.isRunning && (className === 'idx' || className === 'file-date' || className === 'file-name')) {
        const domTableRow = event.target.parentElement
        const domTableRowDate = domTableRow.querySelector('.file-date')
        const domTableRowFileName = domTableRow.querySelector('.file-name')
        const folder = domTableRowDate.getAttribute('data')
        const fileName = domTableRowFileName.getAttribute('data')
        domFolderPath.setAttribute('data', folder)
        domFileName.setAttribute('data', fileName)
        domFolderPath.value = folder
        domFileName.value = fileName
        domTableRow.parentElement.querySelectorAll('.table__row').forEach(row => {
            row.classList.remove('active-row')
        })
        domTableRow.classList.add('active-row')
        window.api.send('file:load', { folder, fileName })
    }
})

// Handle click event on Open File button
domLoadData.addEventListener('click', () => {
    if (!state.isRunning) {
        const filePathBase = domFolderPath.getAttribute('data')
        const fileName = domFileName.getAttribute('data')
        window.api.send('file:open', { filePathBase, fileName })
    }
})


// Handle click event on open file in the file menu
window.api.receive('file:open', () => {
    window.api.send('file:path', isFolder = false)
})

// Populate options with ports
window.api.receive('serial:ports', (ports) => {

    const isEqual = (a, b) => {
        if (a.length !== b.length) { return false }
        for (let i of a) {
            if (!b.includes(i)) { return false }
        }
        return true
    }

    const items = []
    if (ports.length === 0) { ports.push('COMX') }
    if (!isEqual(state.portList, ports)) {
        state.portList = [...ports]
        ports.forEach(port => {
            items.push(`<option value='${port}'>${port}</option>`)
        })

        domSerialPorts.innerHTML = items.join('')
    }
})

// update ui on receiving connection status
window.api.receive('serial:connection', (isPortOpen, error) => {
    state.voltage = isPortOpen ? state.voltage : 0
    state.current = isPortOpen ? state.current : 0
    state.isPortOpen = isPortOpen
    state.errorMessage = error
    state.status = !error ? 'disconnected' : 'error'
    showStatusMessage()
    updateUI()
})

// On receiving path update file path
window.api.receive('file:path', ({ error, folderPath, fileName }) => {
    if (error) {
        console.log(error)
    }
    else if (folderPath && fileName) {
        domFolderPath.value = folderPath
        updateDataTable(folderPath, fileName)
    } else if (folderPath) {
        domFolderPath.value = folderPath
    }
    else {
        console.log('No folder was selected!')
    }
})

// On receiving data act accordingly
window.api.receive('current-voltage:data', (raw_data) => {
    const text_data = raw_data.split(',')
    if (text_data[2] == 'READY') {
        state.deviceModel = text_data[0]
        state.firmwareVersion = text_data[1]
        state.isReady = true
        state.isRunning = false
        state.status = 'ready'
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
        state.status = state.overflow ? 'overflow' : 'running'
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
            state.status = 'ready'
        }
    }
    updateUI()
    showStatusMessage()
})

// On saving data query for list of files
window.api.receive('file:save', ({ folder, fileName, error }) => {
    if (fileName) {
        state.isWritingData = false
        updateDataTable(folder, fileName)
    } else if (error) {
        console.log(error)
    } else {
        console.log('Something went wrong in saving file!')
    }
})

// On receiving list of files update dom
window.api.receive('file:list', ({ dataFiles, error }) => {
    if (error) {
        console.log(error)
    }
    else if (dataFiles) {
        state.dataFiles = dataFiles
        listAllFilesInTable(dataFiles)
    }
})

// On receiving data of the selected file
window.api.receive('file:load', ({ error, mainDataText, mainDataObj, metaDataObj }) => {
    if (error) {
        console.log(error)
    }
    else if (mainDataText && mainDataObj && metaDataObj) {
        const params = {
            scanId,
            methodType,
            deviceModel,
            firmwareVersion,
            currMax,
            estart,
            estop,
            estep,
            scanrate,
            ncycles,
            equilibrationTime,
            timeOfMeasurement
        } = metaDataObj

        state.data = mainDataObj
        domMainData.innerText = mainDataText
        domMetaData.innerText = `ScanId: ${scanId}
        Method Type: ${methodType}
        Device Model: ${deviceModel}
        Firmware Version: ${firmwareVersion}
        Current Max: ${currMax}
        Start Potential: ${estart}
        End Potential: ${estop}
        Potential Step: ${estep}
        Scan Rate: ${scanrate}
        Number of Cycles: ${ncycles}
        Equilibration time: ${equilibrationTime}
        Time of Measurement: ${timeOfMeasurement}`

        updateParams(params)
        draw(state)
    }
    else {
        console.log('Something went wrong!')
    }
})