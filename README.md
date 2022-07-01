# Splunk traces visualization

This splunk application contains a visualization that uses [apache echarts library](https://echarts.apache.org/en/index.html) to show logs traces.

## TODO: SPECIFICATIONS & USAGE

## Building the visualization

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

## More Information
For more information on building custom visualizations including a tutorial, API overview, and more see:

http://docs.splunk.com/Documentation/Splunk/6.5.0/AdvancedDev/CustomVizDevOverview
