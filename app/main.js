const { app, BrowserWindow, ipcMain } = require("electron")
const path = require("path")
const SerialPort = require("serialport")

const windows = new Set()


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

ipcMain.on("get-port", (event) => {
    const window = BrowserWindow.getFocusedWindow()
    SerialPort.list()
        .then(ports => {
            window.send("send-port", ports.map(port => port.path));
        })
        .catch(error => console.log(error))
})

ipcMain.on("connect-serial", (event, port) => {
    const window = BrowserWindow.getFocusedWindow()
    const serialPort = new SerialPort(port, { autoOpen: false })
    serialPort.open((error) => {
        if (error) {
            console.log(`Error opening port => ${error.message}`)
            window.send("connection-open", false)
        }
        else {
            console.log("Connected to serial")
            window.send("connection-open", true)
        }
    })

});