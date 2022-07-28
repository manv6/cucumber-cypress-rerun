# cucumber-cypress-rerun


# cucumber-cypress-rerun [![ci status][ci image]][ci url] [![renovate-app badge][renovate-badge]][renovate-app] ![cypress version](https://img.shields.io/badge/cypress-10.3.1-brightgreen)

> A plugin to run cypress cucumber scenarios multiple times

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
npx cucumber-cypress-rerun run -n <N> ... rest of "cypress run" arguments
```

Which will run Cypresss `<N>` times, exiting after the first failed run or after all runs finish successfully.

### Until passes

You can flip the logic and run Cypress up to N times until the first successful exit

```shell
npx cucumber-cypress-rerun run -n <N> --until-passes ... rest of "cypress run" arguments
```
### Rerun only failed Specs

You can rerun only the specs that failed

```shell
npx cucumber-cypress-rerun run -n <N> --until-passes --rerun-failed-only ... rest of "cypress run" arguments
```

### Env variables

Every run has two utility variables injected

```js
const n = Cypress.env('cypress_repeat_n') // total repeat attempts
const k = Cypress.env('cypress_repeat_k') // current attempt, starts with 1
                                          // and is <= n
```

## Debugging

Run this script with environment variable `DEBUG=cucumber-cypress-rerun` to see verbose logs

## What about test retries?

This NPM module retries the entire Cypress run, if you need to retry just the failed tests, use the [Test Retries](https://docs.cypress.io/guides/guides/test-retries).

[ci image]: https://github.com/manv6/cucumber-cypress-rerun/workflows/ci/badge.svg?branch=main
[ci url]: https://github.com/manv6/cucumber-cypress-rerun/actions
[renovate-badge]: https://img.shields.io/badge/renovate-app-blue.svg
[renovate-app]: https://renovateapp.com/