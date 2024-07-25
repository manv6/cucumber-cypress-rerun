#!/usr/bin/env node

// @ts-nocheck
const debug = require('debug')('cucumber-cypress-rerun')
const fs = require('fs')
const pathModule = require('path');

// allows us to debug any cypress install problems
debug('requiring cypress with module.paths %o', module.paths)
const cypress = require('cypress')

const arg = require('arg')
const Bluebird = require('bluebird')
const { empty } = require('ramda')

// if there is an .env file, loads it and add to process.env
require('dotenv').config()

debug('process argv %o', process.argv)
const args = arg(
  {
    '--feature-files': String,
    '--delay': String,
    '--repeat': String,
  },
  { permissive: true },
)
const name = 'cucumber-cypress-rerun:'
const repeatNtimes =  '--repeat' in args ? args['--repeat'] : '2'
const featureFilesPath = '--feature-files' in args ? args['--feature-files'] : 'cypress/e2e/'
const dealyBetweenRuns = '--delay' in args ? args['--delay'] : '0'

console.log('%s will repeat Cypress command %d time(s)', name, repeatNtimes)
console.log('%s will delay Cypress command %d time(s)', name, dealyBetweenRuns)
console.log('%s will look for feature files in %s folder', name, featureFilesPath)

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
const replaceFeatureTitle = (data) => {
    // Split the file content into lines
    const lines = data.split(/\r?\n/);

    // Modify lines that start with 'Feature:'
    const modifiedLines = lines.map(line => {
      if (line.startsWith('Feature:')) {
        return line + ' - Rerun'; // Append your string here
      }
      return line;
    });
  
    // Join the modified lines back into a single string
    const modifiedData = modifiedLines.join('\n');  
    return modifiedData;

}

const parseFeatureFiles = async (tempfailedSpecs, failedSpecs) => {

    failedSpecs.forEach((file) => {
      fs.stat(file, (err, stats) => {
        if (err) {
          console.error(`Error getting stats for ${file}: ${err}`);
          return;
        }

          // If it's a file, process it
          let result
          fs.readFile(file, 'utf8', (err, data) => {
            if (err) {
              console.error(`Error reading file ${file}: ${err}`);
              return;
            }
            result = replaceFeatureTitle(data)
            tempfailedSpecs.forEach((test) => {
              if (test.includes('(example')) {
                result = result.replace(
                  new RegExp(`Scenario Outline: ${test.substring(0, test.length - 13)}\\b`, 'g'),
                  `\t@failed \n\tScenario Outline: ${test.substring(0, test.length - 13)} - rerun`
                );
              } else if (result.includes(`Scenario: ${test}`)) {

                result = result.replace(
                  new RegExp(`Scenario: ${test}\\b`, 'g'),
                  `\t@failed \n\tScenario: ${test} - rerun`
                );
              }
            });

            if (result !== data) {
              fs.writeFile(file, result, 'utf8', (err) => {
                if (err) {
                  console.error(`Error writing file ${file}: ${err}`);
                  return;
                }
                console.log(`File ${file} updated`);
              });
            }
          });
      });
    });
};


const promiseWaitForDatadog = async () => {
  await new Promise(resolve => setTimeout(resolve, 3000)).then(() => {});
};

let tags = ''
parseArguments()
  .then(async (options) => {
    debug('parsed CLI options %o', options)
    const envOptions = options.env.split(',')
    debug(envOptions)
    for( const envOption of envOptions){
      if (envOption.includes('TAGS'))
        tags = envOption.substring(5,envOption.length);
        debug(`tags that would be replaced by @failed : ${tags}`)
    }
    const allRunOptions = []

    for (let k = 0; k < repeatNtimes; k += 1) {
      const runOptions = clone(options)
      const envVariables = ``
      if (!('env' in runOptions)) runOptions.env = envVariables
      // else runOptions.env += `,${envVariables}`

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
    debug(allRunOptions)
    return allRunOptions
  })
  .then(async (allRunOptions) =>
    // @ts-ignore
    Bluebird.mapSeries(allRunOptions, (runOptions, k, n) => {
      const isLastRun = k === n - 1
      console.log('***** %s %d of %d *****', name, k + 1, n)
      if ((k + 1) === n) {
        console.log('***** waiting for %d secs before rerun *****', parseInt(dealyBetweenRuns))
        const date = Date.now();
        let currentDate = null;
        do {
          currentDate = Date.now();
        } while (currentDate - date < parseInt(dealyBetweenRuns) * 1000);
        console.log('***** Finish waiting starting rerun *****');
      }
      /**
       * @type {(testResults: CypressCommandLine.CypressRunResult | CypressCommandLine.CypressFailedRunResult) => void}
       */
      const onTestResults = (testResults) => {
        debug('is %d the last run? %o', k, isLastRun)
        const tempfailedSpecs = []
        const tempfailedFiles = []
        if (typeof testResults.runs === 'undefined') {
          console.log('***** No tests ran in initial run, nothing to rerun. Exiting... *****')
          promiseWaitForDatadog();
          process.exit(0)
        }
        testResults.runs.forEach((run) => {
          debug(run)
          run.tests.forEach((test) => {
            debug(test)
            const testName = test.title[test.title.length - 1]
            debug(testName)
            if (test.state === 'failed') {
              tempfailedSpecs.push(testName)
              tempfailedFiles.push(run.spec.relative)
            }
          })
        })

        const failedSpecs = testResults.runs
          .filter((run) => run.stats.failures != 0)
          .map((run) => run.spec.relative)
          .join(',')

        if (failedSpecs.length) {
          console.log('%s failed specs', name)
          console.log('failed scenarios %o ', tempfailedSpecs)
          console.log('failed files %o ', tempfailedFiles)
          debug('parsing failed specs for the rerun')
          parseFeatureFiles(tempfailedSpecs, tempfailedFiles)

          debug(allRunOptions)
          if (!isLastRun) {
            const envList = allRunOptions[k + 1].env.split(',');
            if (tags != empty) {
              allRunOptions[k + 1].env = envList[0].replace(
                tags,
                '@failed',
              )
              if(envList[1] !== undefined)
                allRunOptions[k + 1].env = allRunOptions[k + 1].env.concat(',' + envList[1])
            }
            else
              allRunOptions[k + 1].env =
                allRunOptions[k + 1].env.concat(',TAGS=@failed')
            allRunOptions[k + 1].spec = failedSpecs
          }
        } else {
          console.log('%s there were no failed specs', name)
          console.log('%s exiting', name)
          promiseWaitForDatadog();
          process.exit(0)
        }
        // console.log(JSON.stringify(testResults))
        // if (testResults)
        //   if (testResults.failures) {
        //     console.log(testResults.message)
        //     promiseWaitForDatadog();
        //     process.exit(1)
        //   }

        if (testResults)
          if (testResults.totalFailed) {
            if (!testResults.totalFailed) {
              console.log(
                '%s successfully passed on run %d of %d',
                name,
                k + 1,
                n,
              )
              promiseWaitForDatadog();
              process.exit(0)
            }
            console.error('%s run %d of %d failed', name, k + 1, n)
            if (k === n - 1) {
              console.error('%s no more attempts left', name)
              promiseWaitForDatadog();
              process.exit(1)
            }
            console.error('%s run %d of %d failed', name, k + 1, n)
            if (isLastRun) { 
              promiseWaitForDatadog();
              process.exit(1) 
            }
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
    promiseWaitForDatadog();
    process.exit(1)
  })
