const fs = require('fs')
const os = require('os')
const path = require('path')
const { writeToPath } = require('@fast-csv/format')

const timeString = (time = null) => {
    time = time ? time : new Date()
    const year = time.getFullYear()
    const month = (time.getMonth() + 1).toString().padStart(2, '0')
    const date = time.getDate().toString().padStart(2, '0')
    const hours = time.getHours().toString().padStart(2, '0')
    const minutes = time.getMinutes().toString().padStart(2, '0')
    const seconds = time.getSeconds().toString().padStart(2, '0')
    const milliSeconds = time.getMilliseconds().toString().padStart(3, '0')

    return `${year}${month}${date}_${hours}${minutes}${seconds}${milliSeconds}`
};


const helpers = {}
helpers.data = {
    folders: [],
    currentFolder: ''
}
const dataFolderName = 'zerostat'
const dataFoldersFileName = '.zerostat'
const dataFileExt = '.zst'


helpers.updateDataFolders = (dataFolderPath = '') => {
    const dataFoldersFilePath = path.join(os.homedir(), dataFoldersFileName)

    // if the .zerostat file is present in the home directory then
    // read the file and update the helpers.data else create a blank 
    // helpers.data object
    if (fs.existsSync(dataFoldersFilePath)) {
        const dataFolders = fs.readFileSync(dataFoldersFilePath, 'utf-8')
        helpers.data = JSON.parse(dataFolders)
    }

    // if data folder path is not provided then assign ..temp/zerostat as the path
    if (!dataFolderPath) {
        dataFolderPath = path.join(os.tmpdir(), dataFolderName)
    }

    // set current folder
    helpers.data.currentFolder = dataFolderPath

    // if data folder path doesn't exist then create the folder
    if (!fs.existsSync(dataFolderPath)) {
        fs.mkdirSync(dataFolderPath)
    }

    // if the data folder path is not available in the helpers.data.folders
    // then push that to the data.folders
    if (helpers.data.folders.indexOf(dataFolderPath) === -1) {
        helpers.data.folders.push(dataFolderPath)
    }

    // Save the changes to the .zerostat file
    fs.writeFileSync(dataFoldersFilePath, JSON.stringify(helpers.data))
}



helpers.toTitleCase = (str) => {
    if (str.length > 1) {
        return `${str[0].toUpperCase()}${str.slice(1).toLowerCase()}`
    }

    return str.toUpperCase()
}

helpers.extractData = (data) => {
    const startMeta = 0
    const endMeta = 6
    const startData = 8
    const endData = -1
    const result = {}

    try {
        const metadData = data.toString().split('\n').slice(startMeta, endMeta).join('\n')
        const mainData = data.toString().split('\n').slice(startData, endData)
        const mainDataText = mainData.join('\n')
        const mainDataObj = mainData.map(rd => {
            const d = rd.split(',').map(xy => {
                return Number(xy)
            })
            return { x: d[0], y: d[1] }
        })
        result.metaData = metadData
        result.mainDataText = mainDataText
        result.mainDataObj = mainDataObj
    } catch (err) {
        result.error = err
    }

    return result
}

helpers.readFile = (fname, func) => {
    fs.readFile(fname, 'utf-8', (error, data) => {
        if (error) {
            func({ error })
        } else {
            func({ data })
        }
    })
}

helpers.listDataDir = (func) => {
    const dataFiles = {}

    try {
        helpers.data.folders.forEach(folder => {
            let files = fs.readdirSync(folder)
            dataFiles[folder] = files.filter(file => dataFileExt === path.extname(file))
        })
        func({ dataFiles })
    } catch (error) {
        func({ error })
    }
}

helpers.writeToCSV = (() => {
    let scanNum = 0;

    return (dataStream, currentFolder, func) => {
        const {
            deviceModel,
            firmwareVersion,
            method: { type: methodType, params: { estart, estop, estep, scanrate } },
            data } = dataStream;
        const scanId = `${timeString()}_${(++scanNum).toString().padStart(3, '0')}`
        const filePath = path.join(currentFolder, `${scanId}_${methodType.toLowerCase()}${dataFileExt}`)
        const newData = data.map(({ x, y }) => {
            return [x, y]
        });
        const header = [
            [`Scan ID: ${scanId}`],
            [`Method: ${methodType}`],
            [`Device Model: ${deviceModel}-${firmwareVersion}`],
            [`E start: ${estart} V; E Stop: ${estop} V; E Step: ${estep} mV`],
            [`Scan rate: ${scanrate}`],
            [`Time of measurement: ${new Date().toISOString()}`],
            ['======= start ======='],
            ['Voltage (V)', 'Current (uA)'],
        ];

        writeToPath(filePath, [...header, ...newData])
            .on('error', error => func({ error }))
            .on('finish', () => func({ filePath }))
    }
})()

module.exports = helpers