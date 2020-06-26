// Copyright (c) 2015, Jessica Lord All rights reserved.
// This code is licensed under BSD license (see https://github.com/jlord/offline-issues/blob/master/LICENSE.md for details)

var fs = require('fs')
var path = require('path')

var mkdirp = require('mkdirp')
var handlebars = require('handlebars')
var marked = require('marked')
var cpr = require('cpr')

marked.setOptions({
  renderer: new marked.Renderer(),
  gfm: true,
  tables: true,
  breaks: false,
  pedantic: false,
  smartLists: true,
  smartypants: false
})

module.exports = function writehtml (options, cb) {
  if (options.destination) {
    var dest = path.resolve(options.destination, 'html')
  } else {
    var dest = 'html'
  }

  mkdirp.sync(dest)

  if (!options.noStatic) {
    var from = path.resolve(__dirname, '..', 'static')
    cpr(from, dest, { overwrite: true }, function (err, files) {
      if (err) return cb(err, 'Error copying directory.')
      // TODO this may finish after making the HTML files does
    })
  }

  var issues = fs.readFileSync('comments.json')
  issues = JSON.parse(issues)
  issues.forEach(function (issue) {
    issue = parseBody(issue)
    var filename = repoDetails(issue.url)
    var source = fs.readFileSync(path.join(__dirname, '/templates/html.hbs'))
    var template = handlebars.compile(source.toString())
    var result = template(issue)
    fs.writeFile(dest + '/' + filename + '.html', result, function (err) {
      if (err) return cb(err, 'Error writing HTML file.')
    })
  })
  cb(null, 'Wrote html files.')
}

function repoDetails (issue) {
  var a = issue.split('/')
  var filename = a[3] + '-' + a[4] + '-' + a[6]
  return filename
}

// since comments are in Markdown
// we should parse them into HTML
// before putting them in the template
function parseBody (issue) {
  if (issue.body === null) issue.body = ''
  else issue.body = marked(issue.body)
  issue.comments = issue.comments.map(function (issue) {
    issue.body = marked(issue.body)
    return issue
  })
  return issue
}
