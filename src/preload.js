const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld(
    'api', {
    send: (channel, data) => {
        let validChannels = [
            'current-voltage:sweep',
            'file:list',
            'file:load',
            'file:open',
            'file:path',
            'file:save',
            'serial:connection',
            'serial:ports'
        ]
        if (validChannels.includes(channel)) {
            ipcRenderer.send(channel, data)
        }
    },
    receive: (channel, func) => {
        let validChannels = [
            'current-voltage:data',
            'file:list',
            'file:load',
            'file:open',
            'file:path',
            'file:save',
            'serial:connection',
            'serial:ports'
        ]
        if (validChannels.includes(channel)) {
            ipcRenderer.on(channel, (event, ...args) => func(...args))
        }
    }
})