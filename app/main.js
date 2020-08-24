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
    const window = BrowserWindow.getFocusedWindow()

    if (window) {
        SerialPort.list()
            .then(ports => {
                window.send("send-ports", ports.map(port => port.path));
            })
            .catch(error => console.log(error))
    }
})


ipcMain.on("disconnect-serial", (event) => {
    if (port && port.isOpen) {
        port.close()
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
                    console.log(`Error opening port => ${error.message}`)
                    senderWindow.send("connection-open", false)
                }
                else {
                    console.log("==> connected")
                    port.on("close", () => {
                        port = null
                        parser = null
                        senderWindow.send("connection-open", false)
                        console.log("==> disconnected")
                    })

                    parser.on('data', (data) => {
                        senderWindow.send("send-data", data)
                    })

                    senderWindow.send("connection-open", true)
                }
            })
        }
    }

})

ipcMain.on("control-sweep", (event, running) => {
    if (running) {
        port.write("5,0,1,127,0,255")
    }
    else {
        port.write("5,1,1,127,0,255")
    }

})