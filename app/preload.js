const { contextBridge, ipcRenderer } = require("electron")

contextBridge.exposeInMainWorld(
    "api", {
    send: (channel, data) => {
        let validChannels = ["get-port", "connect-serial", "start-sweep"]
        if (validChannels.includes(channel)) {
            ipcRenderer.send(channel, data)
        }
    },
    receive: (channel, func) => {
        let validChannels = ["send-port", "connection-open", "respond-hello"]
        if (validChannels.includes(channel)) {
            ipcRenderer.on(channel, (event, ...args) => func(...args))
        }
    }
})