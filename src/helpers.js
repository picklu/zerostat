const fs = require('fs')
const os = require('os')
const path = require('path')
const { writeToPath } = require('@fast-csv/format')

const tmpDir = path.join(os.tmpdir(), 'zerostat')
if (!fs.existsSync(tmpDir)) { fs.mkdirSync(tmpDir) }
const helpers = {}


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

helpers.listTmpDir = (func) => {
    fs.readdir(tmpDir, (error, files) => {
        if (error) {
            func({ error });
        } else {
            func({ files, tmpDir });
        }
    })
}

helpers.writeToCSV = (() => {
    let scanNum = 0;
    return (dataStream, func) => {
        const {
            deviceModel,
            firmwareVersion,
            method: { type: methodType, params: { estart, estop, estep, scanrate } },
            data } = dataStream;
        const scanId = `${timeString()}_${(++scanNum).toString().padStart(3, '0')}`
        const filePath = path.join(tmpDir, `${scanId}_${methodType.toLowerCase()}.txt`)
        const newData = data.map(({ x, y }) => {
            return [x, y]
        });
        const header = [
            [`Scan ID: ${scanId}`],
            [`Method: ${methodType}`],
            [`Device Model: ${deviceModel}-${firmwareVersion}`],
            [`E start: ${estart} V; E Stop: ${estop} V; E Step: ${estep} mV`],
            [`Scan rate: ${scanrate}`],
            [`Measured time: ${new Date().toISOString()}`],
            ['======= start ======='],
            ['Voltage (V)', 'Current (uA)'],
        ];

        writeToPath(filePath, [...header, ...newData])
            .on('error', error => func({ error }))
            .on('finish', () => func({ filePath }))
    }
})()

module.exports = helpers