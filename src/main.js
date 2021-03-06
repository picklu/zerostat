require('dotenv').config()
const { app, BrowserWindow, ipcMain, Menu } = require("electron")
const path = require("path")
const SerialPort = require("serialport")
const Readline = require("@serialport/parser-readline")
const { stat } = require("fs")
const { send } = require("process")
const spawn = require("child_process").spawn
const menu = require('./menu')
const { extractData, listTmpDir, readFile, toTitleCase, writeToCSV } = require("./helpers")

const windows = new Set()

let port = null
let parser = null

app.on("ready", () => {
    createWindow()
})

app.on("window-all-closed", () => {
    if (process.platform === "darwin" || process.platform === 'win32') {
        return false
    }
    app.quit()
})

const createWindow = exports.createWindow = () => {
    let x, y
    const windowTitle = `${toTitleCase(app.getName())} | V-${app.getVersion()}`
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

Menu.setApplicationMenu(menu)


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

ipcMain.on("save", (event, state) => {
    const senderWindow = event.sender

    writeToCSV(state, ({ filePath, error }) => {
        if (filePath) {
            senderWindow.send("saved", { filePath })
            console.log('successfully saved')
        }
        else if (error) {
            senderWindow.send("saved", { error })
            console.log(error)
        } else {
            console.log("Something went wrong!")
        }
    })
})

ipcMain.on("listFiles", (event) => {
    const senderWindow = event.sender

    listTmpDir(({ error, files, tmpDir }) => {
        if (error && error.path) {
            senderWindow.send("listFiles", { error });
        } else if (files) {
            senderWindow.send("listFiles", { files, tmpDir });
        } else {
            senderWindow.send("listFiles", { error: "Something went wrong!" });
        }
    })
})


ipcMain.on("load", (event, fname) => {
    const senderWindow = event.sender

    readFile(fname, ({ error, data }) => {
        if (error) {
            senderWindow.send("loaded", { error });
        } else if (data) {
            senderWindow.send("loaded", extractData(data));
        } else {
            console.log(result)
            senderWindow.send("loaded", { error: "Something went wrong!" });
        }
    })
})

ipcMain.on("open", (event, fname) => {
    if (fname) {
        spawn('notepad', [fname])
    }
})

console.log(typeof (process.env.DEBUG))