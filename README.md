# cucumber-cypress-rerun [![ci status][ci image]][ci url] [![renovate-app badge][renovate-badge]][renovate-app] ![cypress version](https://img.shields.io/badge/cypress-10.3.1-brightgreen)

> A plugin to run cypress cucumber failed scenarios after run

Read [Wrap Cypress Using NPM Module API](https://glebbahmutov.com/blog/wrap-cypress-using-npm/) and [Retry, Rerun, Repeat](https://www.cypress.io/blog/2020/12/03/retry-rerun-repeat/).

## Install

```shell
npm i -D cucumber-cypress-rerun
# or using Yarn
yarn add -D cucumber-cypress-rerun
```

This module assumes the `cypress` dependency v10.3.0+ has been installed.

## Use

```shell
npx cucumber-cypress-rerun run ... rest of "cypress run" arguments
```

Which will run Cypresss `1` time, exiting after the first failed run or after run finish successfully.
## Feature files path
You should pass the feature file folder as argument for the plugin to know where are the feature files

```shell
--feature-files <path_to_feature_files> ... rest of "cypress run" arguments 
```
## Use tags to make it happen 

Add in env arguments the following 
```shell 
-env TAGS=not @wip and <tag>
```

The plugin will keep the failed scenarios and will replace the selected tag with @failed for the second run to execute only failed ones

## Debugging

Run this script with environment variable `DEBUG=cucumber-cypress-rerun` to see verbose logs

## What about test retries?

This NPM module retries the entire Cypress run, if you need to retry just the failed tests, use the [Test Retries](https://docs.cypress.io/guides/guides/test-retries).

[ci image]: https://github.com/manv6/cucumber-cypress-rerun/workflows/ci/badge.svg?branch=main
[ci url]: https://github.com/manv6/cucumber-cypress-rerun/actions
[renovate-badge]: https://img.shields.io/badge/renovate-app-blue.svg
[renovate-app]: https://renovateapp.com/