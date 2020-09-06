const { app, BrowserWindow, ipcMain } = require("electron")
const path = require("path")
const SerialPort = require("serialport")
const Readline = require('@serialport/parser-readline')
const { send } = require("process")

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
        webPreferences: {
            enableRemoteModule: false,
            nodeIntegration: false,
            contextIsolation: true,
            worldSafeExecuteJavaScript: true,
            preload: path.join(__dirname, "preload.js")
        }
    })

    newWindow.loadFile("./app/index.html")

    newWindow.once("ready-to-show", () => {
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

ipcMain.on("get-ports", (event) => {
    const senderWindow = event.sender
    if (senderWindow) {
        SerialPort.list()
            .then(ports => {
                senderWindow.send("send-ports", ports.map(port => port.path));
            })
            .catch(error => console.log(error))
    }
})


ipcMain.on("disconnect-serial", (event, portPath) => {

    if (port && port.isOpen) {
        port.close()
        port = null
        console.log("==> disconnecting ...")
    }
})

ipcMain.on("connect-serial", (event, portPath) => {
    const senderWindow = event.sender
    if (senderWindow) {
        if (!port) {
            port = new SerialPort(portPath, { autoOpen: false })
            parser = port.pipe(new Readline())
        }

        if (!port.isOpen) {
            port.open((error) => {
                if (error) {
                    port = null
                    parser = null
                    console.log(error.message)
                    senderWindow.send("connection-open", false, error.message)
                }
                else {
                    console.log("==> connected")
                    port.on("close", () => {
                        port = null
                        parser = null
                        senderWindow.send("connection-open", false, "")
                        console.log("==> disconnected")
                    })

                    parser.on('data', (data) => {
                        senderWindow.send("send-data", data)
                    })

                    senderWindow.send("connection-open", true, "")
                }
            })
        }
    }

})

ipcMain.on("control-sweep", (event, state) => {
    const halt = state.isRunning ? 0 : 1
    if (halt) {
        port.write(`0,${halt},0,0,${state.refDAC},0,0`)
    } else {
        const scanrate = state.method.params.scanrate // mV/s
        const delay = (state.step * 1000 * 1000 / scanrate).toFixed(0) // ms
        const estartVolt = state.method.params.estart
        const estopVolt = state.method.params.estop
        const estart = Number(state.refDAC - (state.maxDAC * estartVolt / state.opVolts).toFixed(0)) // Analog to digital
        const estop = Number(state.refDAC - (state.maxDAC * estopVolt / state.opVolts).toFixed(0))  // Analog to digital
        const ncycles = state.method.params.ncycles ? state.method.params.ncycles : 0
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
        port.write(`${delay},${halt},${mode},${ncycles},${state.refDAC},${estart},${estop}`)
    }
})