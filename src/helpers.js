const { writeToPath } = require('@fast-csv/format');

const helpers = {};

const timeString = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const day = now.getDay();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const seconds = now.getSeconds();
    const milliSeconds = now.getMilliseconds();

    return `${year}${month}${day}_${hours}${minutes}${seconds}${milliSeconds}`;
};

helpers.writeToCSV = (dataStream, callback) => {
    const {
        deviceModel,
        firmwareVersion,
        method: { type: methodType, params: { estart, estop, estep } },
        data } = dataStream;
    const filePath = `${methodType}-${timeString()}.txt`;
    const newData = data.map(({ x, y }) => {
        return [x, y];
    });
    const header = [
        [`Method: ${methodType.toUpperCase()} measured by ${deviceModel}-${firmwareVersion}`],
        [`E start: ${estart} V; E Stop: ${estop} V; E Step: ${estep} mV`],
        [`Measured on ${new Date().toISOString()}`],
        [],
        ['Voltage (V)', 'Current (mA)']
    ];

    writeToPath(filePath, [...header, ...newData])
        .on('error', error => callback({ error }))
        .on('finish', () => callback({ filePath }));
};

module.exports = helpers;