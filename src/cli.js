#!/usr/bin/env node

var getIssues = require('./index.js')

var options = require('yargs')
  .usage('Usage: $0 [options] [repository ...]')
  .option('destination', {
    alias: 'd',
    describe: 'Change destination of the generated files'
  })
  .option('html', {
    alias: 'h',
    describe: 'If no repository given, generate HTML from existing offline cache',
    boolean: true
  })
  .option('no-static', {
    alias: 'S',
    describe: "Don't generate static files for HTML format",
    boolean: true
  })
  .option('state', {
    alias: 's',
    describe: 'Filter by issue state',
    choices: ['open', 'closed', 'all'],
    default: 'all'
  })
  .option('token', {
    alias: 'T',
    describe: 'github api token',
    default: ''
  })
  .help('help')
  .argv

  
  getIssues(options, function (err, message) {
    if (err) console.log(err, message)
    console.log(message)
  })