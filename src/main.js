const { app, BrowserWindow, ipcMain } = require("electron")
const path = require("path")
const SerialPort = require("serialport")
const Readline = require("@serialport/parser-readline")
const { send } = require("process")
const { stat } = require("fs")

const windows = new Set()

let port = null
let parser = null

app.on("ready", () => {
    createWindow()
})

app.on("window-all-closed", () => {
    if (process.platform === "darwin") {
        return false
    }
    app.quit()
})

const createWindow = exports.createWindow = () => {
    let x, y
    const windowTitle = `${app.getName()} | v${app.getVersion()}`
    const currentWindow = BrowserWindow.getFocusedWindow()
    if (currentWindow) {
        const [currentWindowX, currentWindowY] = currentWindow.getPosition()
        x = currentWindowX + 10
        y = currentWindowY + 10
    }

    let newWindow = new BrowserWindow({
        x, y,
        show: false,
        title: windowTitle,
        icon: path.join(__dirname, "../app/assets/electrostat.png"),
        webPreferences: {
            enableRemoteModule: false,
            nodeIntegration: false,
            contextIsolation: true,
            worldSafeExecuteJavaScript: true,
            preload: path.join(__dirname, "preload.js")
        }
    })

    newWindow.loadFile("app/index.html")

    newWindow.once("ready-to-show", () => {
        newWindow.maximize()
        newWindow.show()
    })

    newWindow.on("page-title-updated", event => event.preventDefault());

    newWindow.on("closed", () => {

        windows.delete(newWindow)
        newWindow = null
    })

    windows.add(newWindow)
    return newWindow
}

app.allowRendererProcessReuse = false

ipcMain.on("ports", (event) => {
    const senderWindow = event.sender
    if (senderWindow) {
        SerialPort.list()
            .then(ports => {
                senderWindow.send("ports", ports.map(port => port.path));
            })
            .catch(error => console.log(error))
    }
})

ipcMain.on("connection", (event, portPath) => {
    const senderWindow = event.sender
    if (port && port.isOpen) {
        port.close()
        port = null
        console.log("==> disconnecting ...")
    } else if (senderWindow) {
        if (!port) {
            port = new SerialPort(portPath, { baudRate: 115200, autoOpen: false })
            parser = port.pipe(new Readline())
        }

        if (!port.isOpen) {
            port.open((error) => {
                if (error) {
                    port = null
                    parser = null
                    console.log(error.message)
                    senderWindow.send("connection", false, error.message)
                }
                else {
                    console.log("==> connected")
                    port.on("close", () => {
                        port = null
                        parser = null
                        senderWindow.send("connection", false, "")
                        console.log("==> disconnected")
                    })

                    parser.on("data", (data) => {
                        senderWindow.send("data", data)
                    })

                    senderWindow.send("connection", true, "")
                }
            })
        }
    }
})

ipcMain.on("sweep", (event, state) => {
    const halt = state.isRunning ? 0 : 1
    if (halt) {
        port.write(`0,${halt},0,0,${state.refDAC},0,0`)
    } else {
        const stepDAC = Math.round(state.method.params.estep / state.voltRes)
        const dV = stepDAC * state.voltRes  // mV
        const scanrate = state.method.params.scanrate  // mV/s
        const delay = Math.round(dV * 1000 / scanrate) // ms
        const estartVolt = state.method.params.estart
        const estopVolt = state.method.params.estop
        const estart = Math.round(state.refDAC - (state.maxDAC * estartVolt / state.outVolts)) // Analog to digital
        const estop = Math.round(state.refDAC - (state.maxDAC * estopVolt / state.outVolts))   // Analog to digital
        const ncycles = state.method.params.ncycles ? state.method.params.ncycles : 0
        const equilibrationTime = state.method.params.equilibrationtime ? state.method.params.equilibrationtime : 0
        let mode
        switch (state.method.type) {
            case "LSV":
                mode = 0
                break
            case "CV":
                mode = 1
                break
            default:
                mode = -1
                break
        }
        console.log(`estartVolt => ${estartVolt}(${estart}), estopVolt => ${estopVolt}(${estop}), stepDAC => ${stepDAC}, dV => ${dV}, scanrate => ${scanrate}, delay => ${delay}, eqlTime => ${equilibrationTime}`)
        port.write(`${delay},${halt},${mode},${ncycles},${state.refDAC},${estart},${estop},${stepDAC},${equilibrationTime}`)
    }
})