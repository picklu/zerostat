const { app, Menu, shell } = require('electron')


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
            { role: 'about' },
            { type: 'separator' },
            { role: 'quit' }
        ]
    },
        {
            label: 'About',
            submenu: [
                { label: `${app.getName()} version ${app.getVersion()}` },
                { type: 'separator' },
            ]
        })
}

const menu = Menu.buildFromTemplate(template)

module.exports = menu