## Install

Requires Grafana JSON Plugin

To start the server

```
npm install
node index.js
```

requires env.json
```
{"key":"...",
"subDomain": "..."}
```

## Setup 

Server runs on port 3333

For access to all Loggers use url http://localhost:3333

For access to specific site loggers use http://localhost:3333/{siteCode}
 - If there are no loggers/ Interval meters for that site code it will return a 404

## Use

The metrics should display the reference name of all of the site loggers 

#### Custom Functionality - Sum

The sum functionality allows you to add multiple data sets together and return as a single set. 
- Select one of the data sets as the initial metric
- Click additional JSON data and enter ```{"operation":"sum","loggers":[],"name":"name"} ```. The loggers array should contain all the strings of the logger names. An example of this can be seen below

```
{"operation":"sum","loggers":["ELEC - Lift 2","ELEC - Lift 3","ELEC - Lift 4","ELEC - Lift 6"],"name":"Sum of Lifts"}
```




