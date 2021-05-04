const { contextBridge, ipcRenderer } = require("electron")

contextBridge.exposeInMainWorld(
    "api", {
    send: (channel, data) => {
        let validChannels = ["ports", "connection", "sweep"]
        if (validChannels.includes(channel)) {
            ipcRenderer.send(channel, data)
        }
    },
    receive: (channel, func) => {
        let validChannels = ["ports", "connection", "data"]
        if (validChannels.includes(channel)) {
            ipcRenderer.on(channel, (event, ...args) => func(...args))
        }
    }
})