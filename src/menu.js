const { app, Menu, shell } = require('electron')
const { toTitleCase } = require("./helpers")

const template = [
    {
        role: 'help',
        submenu: [
            {
                label: 'More about zerostat',
                click() {
                    shell.openExternal('https://github.com/picklu/zerostat')
                }
            }
        ]
    }
]

if (process.platform === 'darwin' || process.platform === 'win32') {
    template.unshift({
        label: 'File',
        submenu: [
            {
                label: 'Window',
                submenu: [
                    { role: 'reload' },
                    { role: 'forceReload' },
                ]
            },
            { label: 'Open File' },
            { type: 'separator' },
            { label: 'Load Method' },
            { label: 'Save As...' },
            { label: 'Settings' },
            { type: 'separator' },
            { role: 'quit' }
        ]
    },
        {
            label: 'View',
            submenu: [
                { role: 'togglefullscreen' }
            ]
        },
        {
            label: 'About',
            submenu: [
                {
                    role: 'about',
                    submenu: [
                        {
                            label: `${toTitleCase(app.getName())} (Version: ${app.getVersion()})`
                        }
                    ]
                }
            ]
        })
}

if (process.env.DEBUG === 'true') {
    template.push({
        label: 'Debugging',
        submenu: [
            { label: 'Dev Tools', role: 'toggleDevTools' },
            { type: 'separator' },
            { role: 'reload', accelerator: 'Alt+R' }
        ]
    })
}


const menu = Menu.buildFromTemplate(template)

module.exports = menu