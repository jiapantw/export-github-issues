var fs = require('fs')

var axios = require('axios')

var runParallel = require('run-parallel')
var writemarkdown = require('./writemarkdown.js')
var writehtml = require('./writehtml.js')

const githubApiBaseUrl = 'https://api.github.com'
var headers = {'user-agent': 'offline-issues module'}
var issueData = []

const parseRepo = (options, cb) => {
  options.repos = []

  options._.forEach(val => {
    const [ ownerId, name ] = val.split('/')
    let repo = {
      // ref: https://developer.github.com/v3/repos/ format
      name,
      full_name: val,
      owner: {
        id: ownerId,
      },
      issue: {
        filter: {
          id: 'all',
          state: options.state
        }
      }
    }
    if (name.includes('#')) {
      let [ repoName, issueId ] = name.split('#')
      repo.name = repoName
      repo.issue.filter.id = issueId
    }
    options.repos.push(repo)
  })
  const functionsToDo = options.repos.map((repo) => {
    return function (cb) {
      getIssues(repo, cb)
    }
  })
  runParallel(functionsToDo, function (err) {
    if (err) return cb(err, 'Error running in parallel.')
    writeData(options, cb)
  })
}

const getIssues = (repo, cb) => {
  if (repo.issue.filter.id === 'all') return theRequestLoop(repo, cb)

  const url = `${githubApiBaseUrl}/repos/${repo.owner.id}/${repo.name}/issues/${repo.issue.filter.id}`
  console.log('getIssues', url)
  axios(url, {
    headers
  }).then(res => {
    loadIssue(res.data, repo, cb)
  }).catch(err => {
    return cb(err, 'Error in request for issue.')
  })
}

const loadIssue = (body, repo, cb) => {
  var issue = {}

  issue.id = body.id
  issue.url = body.html_url
  issue.title = body.title
  issue.created_by = body.user.login || body.head.user.login
  issue.created_at = new Date(body.created_at).toLocaleDateString()
  issue.body = body.body
  issue.state = body.state
  issue.comments = []
  issue.comments_url = body.comments_url
  issue.milestone = body.milestone ? body.milestone.title : null

  if (repo.issue.filter.id === 'all') {
    issue.quicklink = repo.full_name + '#' + body.html_url.split('/').pop()
  } else issue.quicklink = repo.full_name

  getComments(issue, repo, cb)
}

const getComments = (issue, repo, cb) => {
  var url = ''
  if (repo.issue.filter.id === 'all') {
    url = issue.comments_url
  } else {
    url = `${githubApiBaseUrl}/repos/${repo.owner.id}/${repo.name}/issues/${repo.issue.filter.id}/comments`
  }
  console.log('getComments', url)
  axios(url, {
    headers,
  }).then(res => {
    issue.comments = res.data
    issue.comments.forEach(comment => {
      comment.created_at = new Date(comment.created_at).toLocaleDateString()
    })
    issueData.push(issue)
    cb()
  }).catch(err => {
    return cb(err, 'Error in request for comments.')
  })
}

const writeData = (options, cb) => {
  var data = JSON.stringify(issueData, null, ' ')
  var count = JSON.parse(data).length

  if (count > 250) {
    console.log('Only processing the first 250 issues.')
    var limit = 250
    var excess = count - limit
    var newData = JSON.parse(data).splice(excess, 250)
    data = JSON.stringify(newData)
  }

  fs.writeFile('comments.json', data, function (err) {
    if (err) return cb(err, 'Error in writing data file.')
    writemarkdown(options, cb)
    writehtml(options, cb)
  })
}

let pagenum = 1
let allIssues = []
const theRequestLoop = (repo, cb) => {
  let query = '/issues?state=' + repo.issue.filter.state + '&page='
  let limit = '&per_page=100'
  let url = `${githubApiBaseUrl}/repos/${repo.owner.id}/${repo.name}${query}${pagenum}${limit}`

  console.log('theRequestLoop', url)
  axios(url, {
    headers
  }).then(res => {
    const body = res.data
    if (body.message) return cb(null, body)
    if (body.length === 0) {
      var functionsToDo = allIssues.map(function (issue) {
        return function (cb) {
          loadIssue(issue, repo, cb)
        }
      })
      runParallel(functionsToDo, cb)
      return
    } else {
      if (body.message) return cb(null, body)
      body.forEach(function (issue) {
        return allIssues.push(issue)
      })
      pagenum++
      getIssues(repo, cb)
    }
  }).catch(err => {
    return cb(err, 'Error in request for issue.')
  })
}

module.exports = function ({ token, ...options}, cb) {
  headers['Authorization'] = 'token ' + token
  if (options._.length === 0 && options.html) {
    return writehtml(options, cb)
  }
  if (options._.length === 0) return cb(null, 'No repository given.')
  parseRepo(options, cb)
}
