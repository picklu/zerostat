const { app, BrowserWindow } = require("electron")

const pkgJson = require("../package.json")

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
    const currentWindow = BrowserWindow.getFocusedWindow()
    if (currentWindow) {
        const [currentWindowX, currentWindowY] = currentWindow.getPosition()
        x = currentWindowX + 10
        y = currentWindowY + 10
    }

    let newWindow = new BrowserWindow({
        x, y,
        show: false,
        webPreferences: {
            nodeIntegration: true,
            enableRemoteModule: true
        }
    })

    newWindow.loadFile("./app/index.html")


    newWindow.once("ready-to-show", () => {
        newWindow.setTitle(`${pkgJson.name} | v${pkgJson.version}`)
        newWindow.show()
    })

    newWindow.on("closed", () => {
        windows.delete(newWindow)
        newWindow = null
    })

    windows.add(newWindow)
    return newWindow
}



app.allowRendererProcessReuse = false