#!/usr/bin/env node

// @ts-nocheck
const debug = require('debug')('cucumber-cypress-rerun')
const fs = require('fs')

// allows us to debug any cypress install problems
debug('requiring cypress with module.paths %o', module.paths)
const cypress = require('cypress')

const arg = require('arg')
const Bluebird = require('bluebird')

// if there is an .env file, loads it and add to process.env
require('dotenv').config()

debug('process argv %o', process.argv)
const args = arg(
  {
    '--feature-files': String,
  },
  { permissive: true },
)
const name = 'cucumber-cypress-rerun:'
const repeatNtimes = 2
const featureFilesPath =
  '--feature-files' in args ? args['--feature-files'] : 'cypress/e2e/'

console.log('%s will repeat Cypress command %d time(s)', name, repeatNtimes)
console.log(
  '%s will look for feature files in %s folder',
  name,
  featureFilesPath,
)

/**
 * Quick and dirty deep clone
 */
const clone = (x) => JSON.parse(JSON.stringify(x))

const parseArguments = async () => {
  const cliArgs = args._
  if (cliArgs[0] !== 'cypress') cliArgs.unshift('cypress')

  if (cliArgs[1] !== 'run') cliArgs.splice(1, 0, 'run')

  debug('parsing Cypress CLI %o', cliArgs)
  return await cypress.cli.parseRunArguments(cliArgs)
}

const parseFeatureFiles = async (tempfailedSpecs, path) => {
  fs.readdir(path, (err, files) => {
    debug(`All files: ${path} with: ${files}`)
    if (err) return console.log(err)
    files.forEach((file) => {
      let result
      fs.readFile(path + '/' + file, 'utf8', (err, data) => {
        if (err) return console.log(err)
        result = data
        tempfailedSpecs.forEach((test) => {
          if(result.includes(`Scenario: ${test}`))
            debug(`Replacing Scenario: ${test} with: `)
            debug(`@failed \nScenario: ${test}`)
            result = result.replace(
              `Scenario: ${test}`,
              `\t@failed \n\tScenario: ${test}`,
            );
        })
        if(result !== data)
          fs.writeFile(path + '/' + file, result, 'utf8', (err) => {
            if (err) return console.log(err)
            debug('Scenario replaced')
          });
        result = ''
      })
    })
  })
}

let tags = ''
parseArguments()
  .then((options) => {
    debug('parsed CLI options %o', options)
    if (options.env.includes('TAGS'))
      tags = options.env.replace('TAGS=not @wip and ', '')
    debug(`tags that would be replaced by @failed : ${tags}`)

    const allRunOptions = []

    for (let k = 0; k < repeatNtimes; k += 1) {
      const runOptions = clone(options)
      const envVariables = `allureClearSkippedTests=true`
      if (!('env' in runOptions)) runOptions.env = envVariables
      else runOptions.env += `,${envVariables}`

      if (options.record && options.group) {
        // if we are recording, thus we need to update the group name to avoid clashing
        runOptions.group = options.group
        if (runOptions.group && repeatNtimes > 1)
          // make sure if we are repeating this example the recording has group names
          // like "example-1-of-20", "example-2-of-20", ...
          runOptions.group += `-${k + 1}-of-${repeatNtimes}`
      }
      allRunOptions.push(runOptions)
     
    }
    debug(allRunOptions);
    return allRunOptions
  })
  .then((allRunOptions) =>
    // @ts-ignore
    Bluebird.mapSeries(allRunOptions, (runOptions, k, n) => {
      const isLastRun = k === n - 1
      console.log('***** %s %d of %d *****', name, k + 1, n)

      /**
       * @type {(testResults: CypressCommandLine.CypressRunResult | CypressCommandLine.CypressFailedRunResult) => void}
       */
      const onTestResults = (testResults) => {
        debug('is %d the last run? %o', k, isLastRun)
        const tempfailedSpecs = []
          testResults.runs.forEach((run) => {
            run.tests.forEach((test) => {
              debug(test.title[2])
              if (test.state === 'failed') tempfailedSpecs.push(test.title[2])
            })
          })

        const failedSpecs = testResults.runs
          .filter((run) => run.stats.failures != 0)
          .map((run) => run.spec.relative)
          .join(',')

        if (failedSpecs.length) {
          console.log('%s failed specs', name)
          debug('failed specs %o ', tempfailedSpecs)
          debug('parsing failed specs for the rerun')
          parseFeatureFiles(tempfailedSpecs, featureFilesPath)

          debug(allRunOptions)
          if(!isLastRun){
            if (tags)
              allRunOptions[k + 1].env = allRunOptions[k + 1].env.replace(
                tags,
                '@failed',
              )
            else 
              allRunOptions[k + 1].env = allRunOptions[k + 1].env.concat(',tags=@failed')
            allRunOptions[k + 1].spec = failedSpecs
          }
        } else {
          console.log('%s there were no failed specs', name)
          console.log('%s exiting', name)
          process.exit(0)
        }

        if (testResults.status === 'failed')
          if (testResults.failures) {
            console.error(testResults.message)
            return process.exit(testResults.failures)
          }

        if (testResults.status === 'finished')
          if (testResults.totalFailed) {
            if (!testResults.totalFailed) {
              console.log(
                '%s successfully passed on run %d of %d',
                name,
                k + 1,
                n,
              )
              process.exit(0)
            }
            console.error('%s run %d of %d failed', name, k + 1, n)
            if (k === n - 1) {
              console.error('%s no more attempts left', name)
              process.exit(testResults.totalFailed)
            }
            console.error('%s run %d of %d failed', name, k + 1, n)
            if (isLastRun) process.exit(testResults.totalFailed)
          }
      }
      debug(runOptions)
      return cypress.run(runOptions).then(onTestResults)
    }),
  )
  .then(() => {
    console.log('***** finished %d run(s) successfully *****', repeatNtimes)
  })
  .catch((e) => {
    console.log('error: %s', e.message)
    console.error(e)
    process.exit(1)
  })
