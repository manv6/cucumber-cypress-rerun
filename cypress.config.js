const { defineConfig } = require('cypress')

module.exports = defineConfig({
  e2e: {
    fixturesFolder: false,
    pluginsFile: false,
    supportFile: false,
    video: false
  }
})
