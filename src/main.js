require('dotenv').config()
const path = require('path')
const { app, BrowserWindow, dialog, getFocusedWindow, ipcMain, Menu, shell } = require('electron')
const SerialPort = require('serialport')
const Readline = require('@serialport/parser-readline')
const { stat } = require('fs')
const { send } = require('process')
const spawn = require('child_process').spawn
const log = require('electron-log')
const menu = require('./menu')
const helpers = require('./helpers')

const windows = new Set()
let port = null
let parser = null

helpers.updateDataFolders()


const createWindow = exports.createWindow = () => {
    let x, y
    const windowTitle = `${helpers.toTitleCase(app.getName())} | V-${app.getVersion()}`
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
        icon: path.join(__dirname, '../app/assets/electrostat.png'),
        webPreferences: {
            enableRemoteModule: false,
            nodeIntegration: false,
            contextIsolation: true,
            worldSafeExecuteJavaScript: true,
            preload: path.join(__dirname, 'preload.js')
        }
    })

    newWindow.loadFile('app/index.html')

    newWindow.once('ready-to-show', () => {
        newWindow.maximize()
        newWindow.show()
    })

    newWindow.on('page-title-updated', event => event.preventDefault())

    newWindow.on('closed', () => {

        windows.delete(newWindow)
        newWindow = null
    })

    windows.add(newWindow)
    return newWindow
}

app.on('ready', () => {
    createWindow()
})

app.on('window-all-closed', () => {
    if (process.platform === 'darwin') app.quit()
})

Menu.setApplicationMenu(menu)
app.allowRendererProcessReuse = false


// IPC events
ipcMain.on('serial:ports', (event) => {
    const senderWindow = event.sender
    if (senderWindow) {
        SerialPort.list()
            .then(ports => {
                senderWindow.send('serial:ports', ports.map(port => port.path))
            })
            .catch(error => log.warn(error))
    }
})

ipcMain.on('serial:connection', (event, portPath) => {
    const senderWindow = event.sender
    if (port && port.isOpen) {
        port.close()
        port = null
        log.info('==> disconnecting ...')
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
                    log.warn(error.message)
                    senderWindow.send('serial:connection', false, error.message)
                }
                else {
                    log.info('==> connected')
                    port.on('close', () => {
                        port = null
                        parser = null
                        senderWindow.send('serial:connection', false, '')
                        log.info('==> disconnected')
                    })

                    parser.on('data', (data) => {
                        senderWindow.send('current-voltage:data', data)
                    })

                    senderWindow.send('serial:connection', true, '')
                }
            })
        }
    }
})

ipcMain.on('current-voltage:sweep', (event, state) => {
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
        const highCurrent = state.method.params.maxcurrent === 150 ? 0 : 1
        let mode = 0
        switch (state.method.type) {
            case 'LSV':
                mode = 0
                break
            case 'CV':
                mode = 1
                break
            default:
                mode = -1
                break
        }
        log.info(`==> estartVolt => ${estartVolt}(${estart})
                    estopVolt => ${estopVolt}(${estop}),
                    stepDAC => ${stepDAC}, 
                    dV => ${dV}, 
                    scanrate => ${scanrate}, 
                    delay => ${delay}, 
                    eqlTime => ${equilibrationTime}
                    highCurrent => ${highCurrent}`)
        port.write(`${delay},${halt},${mode},${ncycles},${state.refDAC},${estart},${estop},${stepDAC},${equilibrationTime},${highCurrent}`)
    }
})

ipcMain.on('file:path', (event, isFolder) => {
    const senderWindow = event.sender

    if (isFolder) {
        dialog
            .showOpenDialog(getFocusedWindow, { properties: ['openDirectory'] })
            .then(result => {
                const folderPath = result.filePaths[0]
                helpers.updateDataFolders(folderPath)
                senderWindow.send('file:path', { folderPath })
            }).catch(error => {
                log.warn(error)
                senderWindow.send('file:path', { error })
            })
    } else {
        dialog
            .showOpenDialog(getFocusedWindow,
                { properties: ['openfile'] },
                { filters: [{ extentions: ['zst'] }] }
            )
            .then(result => {
                const filePath = result.filePaths[0]
                const fileName = path.basename(filePath)
                const folderPath = path.dirname(filePath)
                helpers.updateDataFolders(folderPath)
                senderWindow.send('file:path', { folderPath, fileName })
            }).catch(error => {
                log.warn(error)
                senderWindow.send('file:path', { error })
            })
    }
})

ipcMain.on('file:save', (event, state) => {
    const senderWindow = event.sender
    const folder = helpers.data.currentFolder

    helpers.writeToCSV(state, folder, ({ folder, fileName, error }) => {
        if (fileName) {
            senderWindow.send('file:save', { folder, fileName })
            log.info('==> successfully saved')
        }
        else if (error) {
            senderWindow.send('file:save', { error })
            log.warn(error)
        } else {
            log.warn('Something went wrong!')
        }
    })
})

ipcMain.on('file:list', (event) => {
    const senderWindow = event.sender

    helpers.listDataDir(({ error, dataFiles }) => {
        if (error && error.path) {
            senderWindow.send('file:list', { error })
        } else if (dataFiles) {
            senderWindow.send('file:list', { dataFiles })
        } else {
            senderWindow.send('file:list', { error: 'Something went wrong!' })
        }
    })
})

ipcMain.on('file:load', (event, { folder, fileName }) => {
    const senderWindow = event.sender

    if (folder && fileName) {
        const filePath = path.join(folder, fileName)
        helpers.readFile(filePath, ({ error, data }) => {
            if (error) {
                senderWindow.send('file:load', { error })
            } else if (data) {
                helpers.updateDataFolders(folder)
                senderWindow.send('file:load', helpers.extractData(data))
            } else {
                senderWindow.send('file:load', { error: 'Something went wrong!' })
            }
        })
    }
})

ipcMain.on('file:open', (event, { filePathBase, fileName }) => {
    if (filePathBase && fileName) {
        const filePath = path.join(filePathBase, fileName)

        if (process.platform === 'win-32') {
            spawn('notepad', [filePath])
        }
        shell.openPath(filePath)
    }
})

