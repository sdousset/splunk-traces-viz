![](/appserver/static/visualizations/traces_graph/traces_dark.PNG)

# Splunk traces visualization

This splunk application contains a visualization that uses [apache echarts library](https://echarts.apache.org/en/index.html) to show logs traces.

## Usage

You must supply the following information in your seach, for example by ending it with :

```
your search here
| table parentName name requests errors duration latency
```

- Times are in ms.
- Root span parentName must be empty string.

Each row represents a span having different information
Mandatory:
- parentName: the name of span’s parent if applicable
- name: unique name of span
- requests: number of requests for span
- errors: number of errors for span
- duration: duration for span
- latency: elapsed time (in ms) between the span and its parent
	
Thresholding:

```inf_bound,max_bound,[name=]color```

Example: ```0,300,green,300,800,warning=orange,800,max,critical=#800000```

Possible thresholds:
- latencyTh
- errorRateTh


## Building the visualization

Clone this repository into your ```$SPLUNK_HOME/etc/apps/ ``` directory.

	NOTE: You must have npm installed in oder to build. If you do not have npm installed, install it and come back. 
	
The visualization contained in this app must be built using web pack in order to run it on Splunk. There is a basic webpack configuration built in to the app. To build from the command line, first, cd to the *appserver\static\visualizations\traces_graph* directory. On the first run you will have to install the dependeincies with npm:

```
$ npm install
```
Once you done that, you can build the viz with the provided build task:

```
$ npm run build
```

This will create a *visualization.js* file in the visualization directory. 

## TODO's

TODO:
- Add a legend
- Show the name of the threshold in tooltip
- Code refactors
- Drilldown
- Icons


## More Information
For more information on building custom visualizations including a tutorial, API overview, and more see:

http://docs.splunk.com/Documentation/Splunk/6.5.0/AdvancedDev/CustomVizDevOverview
