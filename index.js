var express = require('express');
var bodyParser = require('body-parser');
var _ = require('lodash');
var app = express();
const https = require('https');
app.use(bodyParser.json());
var apiKey = require('./env').key
var subDomain = require('./env').subDomain
var loggerJson = {};
var siteJson = {};

//Call http request and concat data untill there is no more pages, returns a promise
const recursiveHttpGet = (i, data2, url) => new Promise((resolve, reject) => {
  https.get(url + i, (resp) => {
    let data = '';
    resp.on('data', (chunk) => {
      data += chunk;
    });
    return resp.on('end', () => {
      d = JSON.parse(data)
      data2 = data2.concat(d.items)
      if (d.hasMore) {
        resolve(recursiveHttpGet(i + 1, data2, url));
      } else {
        resolve(data2)
      }
    })
  })
})

//Update Site Info and Logger Info
function getSiteJson() {
  recursiveHttpGet(1, [], 'https://' + subDomain + '.energycloud.com/api/v1/Site/?apiKey=' + apiKey + '&pageSize=100&orderBy=id&page=').then(function (r) {
    console.log("Updated SiteJson")
    siteJson = r

  })
}

getSiteJson()

function getLoggerJson() {
  recursiveHttpGet(1, [], 'https://' + subDomain + '.energycloud.com/api/v1/Logger/?apiKey=' + apiKey + '&pageSize=100&orderBy=id&page=').then(function (r) {
    console.log("Updated loggerJson")
    loggerJson = r

  })
}

getLoggerJson()



function setCORSHeaders(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST");
  res.setHeader("Access-Control-Allow-Headers", "accept, content-type");
}


app.all('/', function (req, res) {
  setCORSHeaders(res);
  res.send('I have a quest for you!');
  res.end();
});


//Return a list of the loggers
app.all('/search', function (req, res) {
  setCORSHeaders(res);
  var result = [];
  _.each(loggerJson, function (json) {
    result.push(json.reference);
  });
  res.json(result);
  res.end();
});

//Return a list of loggers based on the site 
app.all('/:query*/search', function (req, res) {
  setCORSHeaders(res);
  var result = [];
  siteId = siteJson.find(item => item.code === req.params.query).id
  r = _.filter(loggerJson, function (t) {
    return t.siteId === siteId;
  });
  _.each(r, function (json) {
    result.push(json.reference);
  });
  res.json(result);
  res.end();
});

///Format date into Optima form yyyy-mm-dd
function formatDate(date) {
  var d = new Date(date),
    month = '' + (d.getMonth() + 1),
    day = '' + d.getDate(),
    year = d.getFullYear();

  if (month.length < 2) month = '0' + month;
  if (day.length < 2) day = '0' + day;
  return [year, month, day].join('-');
}




//Work out logger Id and call recursive http request, returns a promise
function getFromOptima(range, target, siteId) {
  var id;
  if (siteId) {
    r = _.filter(loggerJson, function (t) {
      return t.siteId === siteId;
    });
    id = r.find(item => item.reference === target.target).id
  } else {
    id = loggerJson.find(item => item.reference === target.target).id
  }
  return new Promise(function (resolve, reject) {
    recursiveHttpGet(1, [], 'https://' + subDomain + '.energycloud.com/api/v1/LoggerData?loggerId=' + id + '&channelNumber=1&resolution=30&apiKey=' + apiKey + '&pageSize=100&startDate=' + formatDate(range.from) + '&endDate=' + formatDate(range.to) + '&orderBy=%22dateTime%22&page=').then(function (r) {
      resolve(formatData(r))
    })
  })
}

//Calculates the normazlied values of a data set
//{"operation":"norm"}
function normalizeData(data) {
  var values = data.map(x => x[0]);
  max = Math.max(...values);
  min = Math.min(...values);
  norm = data.map(x => [((x[0] - min) / (max - min)), x[1]])
  return norm;
}


//Calculates the sum of multiple loggers, returns  a promise, example json below
//{"operation":"sum","loggers":["ELEC - Lift 2","ELEC - Lift 3","ELEC - Lift 4","ELEC - Lift 6"]}
function getSumData(range, target, siteId) {
  targets = target.data.loggers
  targets.push(target.target)
  console.log(targets)
  count = 0;
  var r;
  if (siteId) {
    r = _.filter(loggerJson, function (t) {
      return t.siteId === siteId;
    });
  } else {
    console.log("loggerJson")
    r = loggerJson
  }
  return new Promise(function (resolve, reject) {
    for (t in targets) {
      id = r.find(item => item.reference === targets[t]).id
      data = []
      recursiveHttpGet(1, [], 'https://' + subDomain + '.energycloud.com/api/v1/LoggerData?loggerId=' + id + '&channelNumber=1&resolution=30&apiKey=' + apiKey + '&pageSize=100&startDate=' + formatDate(range.from) + '&endDate=' + formatDate(range.to) + '&orderBy=%22dateTime%22&page=').then(function (r) {
        formattedData = formatData(r)

        formattedData.filter(x => { return data.map(y => { if (x[1] === y[1]) { x[0] = x[0] + y[0]; return x; } else { return x; } }) })
        data = formattedData;
        count++
        if (count == targets.length) {
          resolve(data)
        }
      })
    }
  })
}

//Calculates the subtraction of multiple loggers, returns  a promise, example json below
//{"operation":"sub","loggers":["ELEC - Lift 2","ELEC - Lift 3","ELEC - Lift 4","ELEC - Lift 6"]}
function getSubData(range, target, siteId) {
  targets = target.data.loggers
  console.log(targets)
  count = 0;
  var r;
  if (siteId) {
    r = _.filter(loggerJson, function (t) {
      return t.siteId === siteId;
    });
  } else {
    r = loggerJson
  }
  id = r.find(item => item.reference === target.target).id
  return new Promise(function (resolve, reject) {
    recursiveHttpGet(1, [], 'https://' + subDomain + '.energycloud.com/api/v1/LoggerData?loggerId=' + id + '&channelNumber=1&resolution=30&apiKey=' + apiKey + '&pageSize=100&startDate=' + formatDate(range.from) + '&endDate=' + formatDate(range.to) + '&orderBy=%22dateTime%22&page=').then(function (resp) {
      data = formatData(resp)
      for (t in targets) {
        id = r.find(item => item.reference === targets[t]).id
        recursiveHttpGet(1, [], 'https://' + subDomain + '.energycloud.com/api/v1/LoggerData?loggerId=' + id + '&channelNumber=1&resolution=30&apiKey=' + apiKey + '&pageSize=100&startDate=' + formatDate(range.from) + '&endDate=' + formatDate(range.to) + '&orderBy=%22dateTime%22&page=').then(function (r) {
          formattedData = formatData(r)
          data.filter(x => { return formattedData.map(y => { if (x[1] === y[1]) { x[0] = x[0] - y[0]; return x; } else { return x; } }) })
          count++
          if (count == targets.length) {
            resolve(data)
          }
        })
      }

    })
  })
}



//formats the data in grafana from 
function formatData(res) {
  formattedData = []
  for (i in res) {
    formattedData.push([res[i].value, new Date(res[i].dateTime).getTime()])
  }
  return formattedData
}


//gets and sends the query data based on site
app.all(['/:query*/query', '/query'], function (req, res) {
  setCORSHeaders(res);
  console.log(req.url);
  if (req.params.query) {
    //get the siteId from the siteCode
    siteId = siteJson.find(item => item.code === req.params.query).id
  } else {
    siteId = null;
  }
  var tsResult = [];
  _.each(req.body.targets, function (target) {
    if (target.type === 'table') {
      tsResult.push(table);
    } else {
      if (target.data && target.data.operation == "sum") {
        getSumData(req.body.range, target, siteId).then(function (response) {
          name = ((target.data.name) ? target.data.name : "Sum")
          if (target.data && target.data.norm) {
            tsResult.push({ "target": name, "datapoints": normalizeData(response) })
          } else {
            tsResult.push({ "target": name, "datapoints": response })
          }
          if (tsResult.length == req.body.targets.length) {
            console.log("Sum Complete")
            res.json(tsResult);
            res.end();
          }
        })
      } else if (target.data && target.data.operation == "sub") {
        getSubData(req.body.range, target, siteId).then(function (response) {
          name = ((target.data.name) ? target.data.name : "Sub")
          if (target.data && target.data.norm) {
            tsResult.push({ "target": name, "datapoints": normalizeData(response) })
          } else {
            tsResult.push({ "target": name, "datapoints": response })
          }
          if (tsResult.length == req.body.targets.length) {
            console.log("Sub Complete")
            res.json(tsResult);
            res.end();
          }
        })
      } else {
        getFromOptima(req.body.range, target, siteId).then(function (response) {
          if (target.data && target.data.norm) {
            tsResult.push({ "target": target.target, "datapoints": normalizeData(response) })
          } else {
            tsResult.push({ "target": target.target, "datapoints": response })
          }
          if (tsResult.length == req.body.targets.length) {
            console.log("Complete")
            res.json(tsResult);
            res.end();
          }
        })
      }

    }
  });
});

//Check if site has any loggers and if so return 200
app.all('/*', function (req, res) {
  setCORSHeaders(res);
  console.log(req.url.substring(1));
  var k = _.filter(siteJson, function (t) {
    return t.code === req.url.substring(1);
  });
  console.log(k.length)
  if (k.length > 0) {
    res.send('I have a quest for you!');
  } else {
    res.status(404).send('Not found');
  }

  res.end();
});

app.listen(3333);

console.log("Server is listening to port 3333");
