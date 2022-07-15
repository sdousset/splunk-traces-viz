/*
 * Visualization source
 */

class TreeNodeModel {

    constructor(id, name, parentName, latency, duration, parent, requests, errors, requestsTh, errorsTh, errorRateTh, latencyTh, durationTh){
        this.id = id;
        this.name = name;
        this.parentName = parentName;
        this.latency = latency;
        this.duration = duration;
        this.requests = requests;
        this.errors = errors;
        this.errorRate = Math.round((errors / requests) * 100) / 100 ;

        this.requestsTh = requestsTh;
        this.errorsTh = errorsTh;
        this.errorRateTh = errorRateTh;
        this.latencyTh = latencyTh;
        this.durationTh = durationTh;

        this.parent = parent;
        this.prevSibling = null;

        this.children = [];
        this.x = 0;
        this.y = 0;
        this.finalY = 0;
        this.modifier = 0;
    }
}

let myChart;
let rootNode;
let width;
let height;
let nbRequestsQ1;
let nbRequestsQ3;

// Thresholds
let thLatencyMin1;
let thLatencyMax1;
let thLatencyColor1;
let thLatencyMin2;
let thLatencyMax2;
let thLatencyColor2;

let thErrorRateMin1;
let thErrorRateMax1;
let thErrorRateColor1;
let thErrorRateMin2;
let thErrorRateMax2;
let thErrorRateColor2;

// Theme
let theme;

define([
            'jquery',
            'underscore',
            'api/SplunkVisualizationBase',
            'api/SplunkVisualizationUtils',
            // Add required assets to this list
            'echarts'
        ],
        function(
            $,
            _,
            SplunkVisualizationBase,
            vizUtils,
            echarts
        ) {
  
    // Extend from SplunkVisualizationBase
    return SplunkVisualizationBase.extend({
  
        initialize: function() {
            SplunkVisualizationBase.prototype.initialize.apply(this, arguments);
            this.$el = $(this.el);

            // this.$el.append('<h3>This is a custom visualization stand in.</h3>');
            // this.$el.append('<p>Edit your custom visualization app to render something here.</p>');
            
            // Initialization logic goes here
        },

        // Optionally implement to format data returned from search. 
        // The returned object will be passed to updateView as 'data'
        formatData: function(data) {

            let mandatoryFields = ["parentName", "name", "requests", "errors", "duration", "latency"];
            let fieldsName = data.fields.map(field => field.name);
            
            let isOneFieldMissing = false;
            let missingField = "";

            for(let i = 0 ; i < mandatoryFields.length && !isOneFieldMissing ; i++){
                if(fieldsName.find(fieldName => mandatoryFields[i] == fieldName) === undefined){
                    isOneFieldMissing = true;
                    missingField = mandatoryFields[i];
                }
            }
            
            if (isOneFieldMissing) {
                throw new SplunkVisualizationBase.VisualizationError("Missing at least one mandatory field. Missing: \'" + missingField + "\'");
            }

            return data;
        },
  
        // Implement updateView to render a visualization.
        //  'data' will be the data object returned from formatData or from the search
        //  'config' will be the configuration property object
        updateView: function(data, config) {

            // Initialize chart with DOM
            if (!myChart) {
                myChart = echarts.init(this.el);
            }
                var option = {};
            width =  myChart._dom.clientWidth;
            height = myChart._dom.clientHeight;

            // Getting conf / format menu properties if exists
            // Latency thresholds
            thLatencyMin1 = config[this.getPropertyNamespaceInfo().propertyNamespace + 'th_latency_min_1'] || 1000;
            thLatencyMax1 = config[this.getPropertyNamespaceInfo().propertyNamespace + 'th_latency_max_1'] || 1999;
            thLatencyColor1 = config[this.getPropertyNamespaceInfo().propertyNamespace + 'th_latency_color_1'] || '#FFCC00';
            thLatencyMin2 = config[this.getPropertyNamespaceInfo().propertyNamespace + 'th_latency_min_2'] || 2000;
            thLatencyMax2 = config[this.getPropertyNamespaceInfo().propertyNamespace + 'th_latency_max_2'] || 9999999;
            thLatencyColor2 = config[this.getPropertyNamespaceInfo().propertyNamespace + 'th_latency_color_2'] || '#CD3C14';
            // Error rate thresholds
            thErrorRateMin1 = config[this.getPropertyNamespaceInfo().propertyNamespace + 'th_errorRate_min_1'] || 5;
            thErrorRateMax1 = config[this.getPropertyNamespaceInfo().propertyNamespace + 'th_errorRate_max_1'] || 19;
            thErrorRateColor1 = config[this.getPropertyNamespaceInfo().propertyNamespace + 'th_errorRate_color_1'] || '#FFCC00';
            thErrorRateMin2 = config[this.getPropertyNamespaceInfo().propertyNamespace + 'th_errorRate_min_2'] || 20;
            thErrorRateMax2 = config[this.getPropertyNamespaceInfo().propertyNamespace + 'th_errorRate_max_2'] || 100;
            thErrorRateColor2 = config[this.getPropertyNamespaceInfo().propertyNamespace + 'th_errorRate_color_2'] || '#CD3C14';

            theme = config[this.getPropertyNamespaceInfo().propertyNamespace + 'theme'] || 'dark';

            // logic here to build options from data

            // Getting a formatted array of nodes
            let nodes = this.formatInputAndCreateRootNode(data);
            // console.log(nodes);

            this.setNbRequestsQuarters(nodes);

            this.buildTreeRecursively(rootNode, nodes, 2);
            this.prepareData(rootNode, null, 0);
            this.calculateInitialValues(rootNode);
            this.calculateFinalValues(rootNode, 0);
            this.updateYVals(rootNode);
            this.fixNodeConflicts(rootNode);

            // Creating objects for graph construction
            let chartData = [];
            let links = [];

            let [treeWidth, treeHeight] = this.getDimensions(rootNode);
            let levelWidth = width / (treeWidth + 1);
            let levelHeight = height / (treeHeight + 1);

            this.createGraphNodesAndLinks(rootNode, chartData, links, levelWidth, levelHeight);
            
            option = {
                tooltip: {},
                animationDurationUpdate: 1500,
                animationEasingUpdate: 'quinticInOut',
                backgroundColor: theme === 'dark' ? '#000000' : '#F9F9F9' ,
                darkMode: true,
                series: [
                    {
                        type: 'graph',
                        layout: 'none',
                        // Nodes configuration and styling
                        symbol: 'circle',
                        itemStyle: {
                            color: theme === 'dark' ? '#333333' : '#F9F9F9',
                            borderColor: theme === 'dark' ? '#999999' : '#CCCCCC',
                            borderWidth: 1.5,
                        },
                        label: {
                            show: true,
                            position: 'bottom',
                        },
                        // Links and edges configuration and styling
                        lineStyle: {
                            color: theme === 'dark' ? '#666666' : '#999999',
                            opacity: 0.9
                        },
                        edgeSymbol: ['circle', 'arrow'],
                        edgeSymbolSize: [4, 10],
                        data: chartData,
                        links: links
                    }
                ]
            };
            
            myChart.setOption(option);


        },

        setNbRequestsQuarters: function(nodes) {
            var minRequests = Number.POSITIVE_INFINITY;
            var maxRequests = Number.NEGATIVE_INFINITY;
            var tmp;
            for (var i = 0 ; i < nodes.length ; i++ ) {
                tmp = parseInt(nodes[i].requests);
                if (tmp < minRequests) minRequests = tmp;
                if (tmp > maxRequests) maxRequests = tmp;
            }

            let middle = (maxRequests + minRequests) /2;
            nbRequestsQ1 = (middle + minRequests) /2;
            nbRequestsQ3 = (middle + maxRequests) /2;

        },

        formatInputAndCreateRootNode: function(data) {
            let fields = data.fields;
            let rows = data.rows;
            var nodes = [];
            var masterNode = {};
            let id = 1;
            rows.forEach(row => {
                let node = {};
                node.id = id;
                id++;
                fields.forEach(function(field, index) {
                    node[field.name] = row[index];
                });
                if(node.parentName === ""){
                    masterNode = node;
                }
                nodes.push(node);
            });
            rootNode = new TreeNodeModel(
                masterNode.id,
                masterNode.name,
                null,
                parseFloat(masterNode.latency),
                parseFloat(masterNode.duration),
                null, parseInt(masterNode.requests),
                parseInt(masterNode.errors),
                masterNode.requestsTh,
                masterNode.errorsTh,
                masterNode.errorRateTh,
                masterNode.latencyTh,
                masterNode.durationTh
            );
            return nodes;
        },

        buildTreeRecursively: function(node, nodesList) {
            if(nodesList){
                nodesList.forEach(n => {
                    if(node.name === n.parentName){
                        let graphNode = new TreeNodeModel(
                            n.id,
                            n.name,
                            node.name,
                            parseFloat(n.latency),
                            parseFloat(n.duration),
                            node,
                            parseInt(n.requests),
                            parseInt(n.errors),
                            n.requestsTh,
                            n.errorsTh,
                            n.errorRateTh,
                            n.latencyTh,
                            n.durationTh
                        );
                        this.buildTreeRecursively(graphNode, nodesList);
                        node.children.push(graphNode);
                    }
                });
            }
        },

        prepareData: function(node, prevSibling, level) {
            node.prevSibling = prevSibling;
            node.x = level * 300;
            for (let i = 0; i < node.children.length; i++) {
                this.prepareData(
                    node.children[i],
                    i >= 1 ? node.children[i - 1] : null,
                    level + 1
                )
            }
        },

        calculateInitialValues: function(node) {
            for (let i = 0; i < node.children.length; i++) {
                this.calculateInitialValues(node.children[i]);
            }
        
            if (node.prevSibling) {
                node.y = node.prevSibling.y + 400;
            } else {
                node.y = 0;
            }
        
            if (node.children.length == 1) {
                node.modifier = node.y;
            } else if (node.children.length >= 2) {
                let minY = Infinity;
                let maxY = -minY;
                for (let i = 0; i < node.children.length; i++) {
                    minY = Math.min(minY, node.children[i].y);
                    maxY = Math.max(maxY, node.children[i].y);
                }
                node.modifier = node.y - (maxY - minY) / 2;
            }
        },

        calculateFinalValues: function(node, modSum) {
            node.finalY = node.y + modSum;
            for (let i = 0; i < node.children.length; i++) {
                this.calculateFinalValues(node.children[i], node.modifier + modSum);
            }
        },

        updateYVals: function(root) {
            let minYVal = Infinity;
            let nodes = [root];
            while (nodes.length) {
                let node = nodes.shift();
                nodes = nodes.concat(node.children);
                if (node.finalY < minYVal) {
                    minYVal = node.finalY;
                }
            }
        
            nodes = [root];
            while (nodes.length) {
                let node = nodes.shift();
                nodes = nodes.concat(node.children);
                node.finalY += Math.abs(minYVal);
            }
        },

        getContour: function(root, val, func) {
            let nodes = [root];
            while (nodes.length) {
                let node = nodes.shift();
                nodes = nodes.concat(node.children);
                val = func(val, node.finalY);
            }
            return val;
        },

        shiftDown: function(root, shiftValue) {
            let nodes = [root];
            while (nodes.length) {
                let node = nodes.shift();
                nodes = nodes.concat(node.children);
                node.finalY += shiftValue;
            }
        },

        fixNodeConflicts: function(root) {
            for (let i = 0; i < root.children.length; i++) {
                this.fixNodeConflicts(root.children[i]);
            }
        
            for (let i = 0; i < root.children.length - 1; i++) {
                // Get the bottom-most contour position of the current node
                let botContour = this.getContour(root.children[i], -Infinity, Math.max);
        
                // Get the topmost contour position of the node underneath the current one
                let topContour = this.getContour(root.children[i + 1], Infinity, Math.min);
        
                if (botContour >= topContour) {
                    this.shiftDown(root.children[i + 1], botContour - topContour + 150);
                }
            }
        },

        getDimensions: function(root) {
            let minWidth = Infinity;
            let maxWidth = -minWidth;
        
            let minHeight = Infinity;
            let maxHeight = -minWidth;
        
            let nodes = [root];
            while (nodes.length) {
                let node = nodes.shift();
                nodes = nodes.concat(node.children);
        
                if (node.x < minWidth) {
                    minWidth = node.x;
                }
        
                if (node.x > maxWidth) {
                    maxWidth = node.x;
                }
        
                if (node.finalY < minHeight) {
                    minHeight = node.finalY;
                }
        
                if (node.finalY > maxHeight) {
                    maxHeight = node.finalY;
                }
            }
            return [maxWidth - minWidth, maxHeight - minHeight];
        },

        createGraphNodesAndLinks: function(node, data, links, levelWidth, levelHeight) {

            // Node symbolSize and link width and type depending on requests number
            let [symbolSize, lineStyle] = this.getNodeStyleFromRequestsNb(node);
            let duration = this.formatTime(node.duration);
            let nodeLabel = this.getFormattedNodeLabel(node, symbolSize, duration);

            // Style depending on error rate threshold set
            if (node.errorRate >= 0.05) {
                [nodeLabel, lineStyle] = this.styleBasedOnErrorRateThreshold(node, nodeLabel, lineStyle);
            }
            
            let [backgroundColor, borderColor, textColor] = this.getTooltipColorsDependingOnTheme();
            

            let tooltip = {
                backgroundColor: backgroundColor,
                borderColor: borderColor,
                formatter: '' +
                '<h4>' + node.name + '</h4>' +
                '<div class="stats">' +
                    '<div class="row">' +
                        '<p class="number">' + node.requests + '</p>' +
                        '<p class="stats-name requests">Requests</p>' +
                    '</div>' +
                    '<div class="row">' +
                        '<p class="number">' + node.errors + ' (' + node.errorRate * 100 + '%)' + '</p>' +
                        '<p class="stats-name errors">Errors</p>' +
                    '</div>' +
                    '<div class="row">' +
                       ' <p class="number">' + this.formatTime(node.latency) + '</p>' +
                        '<p class="stats-name latency">Latency</p>' +
                    '</div>' +
                    '<div class="row">' +
                        '<p class="number">' + this.formatTime(node.duration) + '</p>' +
                        '<p class="stats-name duration">Duration</p>' +
                    '</div>' +
                '</div>' +
                '<style>' +
                    'h4 { color:' + textColor +'; font-weight: bold }' +
                    '.stats { display: flex; flex-direction: column; }' +
                    '.row { display: flex; margin: 2px 0; }' +
                    'p { margin: 0%; }'  +
                    '.number { width: 75px; color:' + textColor + '}' +
                    '.stats-name  {margin-left: 5px; }' +
                    '.requests { color: #A885D8; }' +
                    '.errors { color: #CD3C14 }' +
                    '.latency { color: #50BE87; }' +
                    '.duration { color: #4BB4E6; }' +
                '</style>'
            };
            
            // Pushing the node to the graph
            data.push({
                id: node.id, name: node.name, x: node.x * levelWidth, y: node.finalY * levelHeight,
                tooltip: tooltip,
                label: nodeLabel,
                symbolSize: symbolSize
            });
            
            // Links
            if (node.parent) {

                // Style if latency threshold set
                let [linkLabel, linkTooltip] = this.styleBasedOnLatencyThreshold(node);
            
                //Push link to list
                links.push({
                    source: node.parent.id.toString(),
                    target: node.id.toString(),
                    label: linkLabel,
                    lineStyle: lineStyle,
                    tooltip: linkTooltip
                });
            }

            for (let i = 0; i < node.children.length; i++) {
                this.createGraphNodesAndLinks(node.children[i], data, links, levelWidth, levelHeight);
            }
        },

        getNodeStyleFromRequestsNb: function(node) {
            // Default values
            let symbolSize = 45;
            let lineStyle = {};
            lineStyle.width = 2;
            lineStyle.type = [20, 3];

            if (node.requests < nbRequestsQ1) {
                symbolSize = 25;
                lineStyle.width = 1;
                lineStyle.type = [10, 2];
            }
            else if (node.requests > nbRequestsQ3) {
                symbolSize = 75;
                lineStyle.width = 4;
                lineStyle.type = [35, 3];
            }

            return [symbolSize, lineStyle];
        },

        formatTime: function(timeInMs) {
            if(!isNaN(timeInMs)){
                let time = timeInMs;
                let timeUnit = 'ms';
                if (timeInMs > 1000) {
                    time = timeInMs / 1000;
                    timeUnit = 's';
                }
                else if (timeInMs < 1 && timeInMs >= 0.001) {
                    time = timeInMs * 1000;
                    timeUnit = 'µs';
                }
                else if (timeInMs < 0.001) {
                    time = timeInMs * 1000000
                    timeUnit = 'ns'
                }
                return Math.round(time * 100) / 100 + ' ' + timeUnit;
            }
            return '-';
        },

        getFormattedNodeLabel: function(node, symbolSize, duration) {
            // Default node label if error rate low
            let nodeLabel = {
                position: 'bottom',
                color: theme === 'dark' ? '#CCCCCC' : '#333333',
                backgroundColor: theme === 'dark' ? 'rgba(51, 51, 51, 0.8)' : 'rgba(221, 221, 221, 0.8)',
                padding: [6, 6],
                formatter: '{nameStyle|{b}} {durationStyle|' +  duration + '}',
                rich: {
                    nameStyle: { fontWeight: 'bold' },
                    durationStyle: { fontSize: 10 }
                },
            }
            
            // If error rate high then draw an inner circle
            if (node.errorRate >= 0.05) {
                nodeLabel = {
                    position: 'inside',
                    backgroundColor: 'transparent',
                    width: symbolSize,
                    height: symbolSize,
                    align: 'center',
                    formatter: 
                        '{upperBufferShapeStyle|}' + 
                        '\n' + 
                        '{errorRateStyle|}' +  
                        '\n' +
                        '{lowerBufferShapeStyle|}' +
                        '\n' + 
                        '{labelStyle|{b}}{durationStyle|' + duration + '}',
                    rich: {
                        upperBufferShapeStyle: { height: 0, width: 0},
                        errorRateStyle: { backgroundColor: 'red', borderRadius: 50, height: 0, width: 0 },
                        lowerBufferShapeStyle: { height: 0, width: 0},
                        labelStyle: {
                            height: 12,
                            padding: [6, 2, 6, 4],
                            color: theme === 'dark' ? '#CCCCCC' : '#333333',
                            backgroundColor: theme === 'dark' ? 'rgba(51, 51, 51, 0.8)' : 'rgba(221, 221, 221, 0.8)',
                            fontWeight: 'bold'
                        },
                        durationStyle: {
                            height: 12,
                            fontSize: 10,
                            padding: [6, 4, 6, 2],
                            color: theme === 'dark' ? '#CCCCCC' : '#333333',
                            backgroundColor: theme === 'dark' ? 'rgba(51, 51, 51, 0.8)' : 'rgba(221, 221, 221, 0.8)',
                        }
                    }
                }

                let errorRateSize = symbolSize * node.errorRate;
                let bufferShapeHeight = (symbolSize / 2) - (errorRateSize / 2);

                nodeLabel.rich.upperBufferShapeStyle.height = bufferShapeHeight;
                nodeLabel.rich.lowerBufferShapeStyle.height = bufferShapeHeight + 5;
                nodeLabel.rich.errorRateStyle.height = errorRateSize;
                nodeLabel.rich.errorRateStyle.width = errorRateSize;
            }

            return nodeLabel;
        },

        styleBasedOnErrorRateThreshold: function(node, nodeLabel, lineStyle) {
            if (node.errorRateTh) {
                let arr = node.errorRateTh.split(',');
                for (let i = 0 ; i < arr.length ; i += 3) {
                    // Getting bounds of threshold
                    let inf_bound = parseInt(arr[i]) / 100;
                    let sup_bound = Infinity;
                    if (arr[i+1] !== "max"){
                        sup_bound = parseInt(arr[i+1]) / 100;
                    }

                    // Check if latency is in threshold interval
                    if (inf_bound < node.errorRate && node.errorRate <= sup_bound) {

                        // Get threshold color and potential name
                        let color = arr[i+2];
                        let thName = "";
                        if (color.includes('=')) {
                            let splitted = color.split('=');
                            thName = splitted[0];
                            color = splitted[1];

                        }
                        nodeLabel.rich.errorRateStyle.backgroundColor = color;
                        if (node.parent) {
                            lineStyle.color = color;
                        }
                    } 
                }
            }
            // Use format menu
            else {
                let errorRate = node.errorRate * 100;
                let color = "";
                if (errorRate >= thErrorRateMin1 && errorRate <= thErrorRateMax1 ) {
                    color = thErrorRateColor1;
                }
                else if (errorRate >= thErrorRateMin2 && errorRate <= thErrorRateMax2) {
                    color = thErrorRateColor2;
                }
                nodeLabel.rich.errorRateStyle.backgroundColor = color;
                if (node.parent) {
                    lineStyle.color = color;
                }
            }

            return [nodeLabel, lineStyle];
        },

        getTooltipColorsDependingOnTheme: function() {
            let backgroundColor = '#000000';
            let borderColor = '#333333';
            let textColor = '#CCCCCC';
            if (theme === 'light') {
                backgroundColor = '#FFFFFF';
                borderColor = '#999999';
                textColor = '#333333';
            }
            return [backgroundColor, borderColor, textColor];
        },

        styleBasedOnLatencyThreshold: function(node) {

            let linkLabel = {
                show: true,
                formatter: this.formatTime(node.latency)
            }

            let [backgroundColor, borderColor, textColor] = this.getTooltipColorsDependingOnTheme();

            let linkTooltip = {
                backgroundColor: backgroundColor,
                borderColor: borderColor,
                formatter: '' +
                '<h4>' + node.parent.name + ' > ' + node.name + '</h4>' +
                '<div class="stats">' +
                    '<div class="row">' +
                        '<p class="number">' + node.requests + '</p>' +
                        '<p class="stats-name requests">Requests</p>' +
                    '</div>' +
                    '<div class="row">' +
                        '<p class="number">' + node.errors + ' (' + node.errorRate + '%)' + '</p>' +
                        '<p class="stats-name errors">Errors</p>' +
                    '</div>' +
                    '<div class="row">' +
                       ' <p class="number">' + this.formatTime(node.latency) + '</p>' +
                        '<p class="stats-name latency">Latency</p>' +
                    '</div>' +
                '</div>' +
                '<style>' +
                    'h4 { color:' + textColor + '; font-weight: bold }' +
                    '.stats { display: flex; flex-direction: column; }' +
                    '.row { display: flex; margin: 2px 0; }' +
                    'p { margin: 0%; }'  +
                    '.number { width: 75px; color:' + textColor + '}' +
                    '.stats-name  {margin-left: 5px; }' +
                    '.requests { color: #A885D8; }' +
                    '.errors { color: #CD3C14 }' +
                    '.latency { color: #50BE87; }' +
                '</style>'        
            }
            
            if (node.latencyTh) {
                let arr = node.latencyTh.split(',');
                for (let i = 0 ; i < arr.length ; i += 3) {
                    // Getting bounds of threshold
                    let inf_bound = parseInt(arr[i]);
                    let sup_bound = Infinity;
                    if (arr[i+1] !== "max") {
                        sup_bound = parseInt(arr[i+1]);
                    }

                    // Check if latency is in threshold interval
                    if (inf_bound < node.latency && node.latency <= sup_bound) {
                        // Get threshold color and potential name
                        let color = arr[i+2];
                        let thName = "";
                        if (color.includes('=')) {
                            let splitted = color.split('=');
                            thName = splitted[0];
                            color = splitted[1];
                            // linkTooltip.formatter = node.parent.name + ' > ' + node.name + '<br/> delay: ' + thName
                        }
                        linkLabel.fontWeight = 'bold';
                        linkLabel.color = color;
                    }
                    
                }
            }
            // Use formatter
            else {
                let latency = node.latency;
                let color = "#999999";
                if (latency >= thLatencyMin1 && latency <= thLatencyMax1 ) {
                    color = thLatencyColor1;
                    linkLabel.fontWeight = 'bold';
                }
                else if (latency >= thLatencyMin2 && latency <= thLatencyMax2) {
                    color = thLatencyColor2;
                    linkLabel.fontWeight = 'bold';
                }
                linkLabel.color = color;
            }
            
            return [linkLabel, linkTooltip]; 
        },

        // Search data params
        getInitialDataParams: function() {
            return ({
                outputMode: SplunkVisualizationBase.ROW_MAJOR_OUTPUT_MODE,
                count: 10000
            });
        },

        // Override to respond to re-sizing events
        reflow: function() {
            myChart.resize();
            width =  myChart._dom.clientWidth;
            height = myChart._dom.clientHeight;

            // Creating objects for graph construction
            let chartData = [];
            let links = [];

            let [treeWidth, treeHeight] = this.getDimensions(rootNode);
            let levelWidth = width / (treeWidth + 1);
            let levelHeight = height / (treeHeight + 1);

            this.createGraphNodesAndLinks(rootNode, chartData, links, levelWidth, levelHeight);

            // console.log(chartData);
            
            option = {
                tooltip: {},
                animationDurationUpdate: 1500,
                animationEasingUpdate: 'quinticInOut',
                backgroundColor: theme === 'dark' ? '#000000' : '#F9F9F9' ,
                darkMode: true,
                series: [
                    {
                        type: 'graph',
                        layout: 'none',
                        // Nodes configuration and styling
                        symbol: 'circle',
                        itemStyle: {
                            color: theme === 'dark' ? '#333333' : '#F9F9F9',
                            borderColor: theme === 'dark' ? '#999999' : '#CCCCCC',
                            borderWidth: 1.5,
                        },
                        label: {
                            show: true,
                            position: 'bottom',
                        },
                        // Links and edges configuration and styling
                        lineStyle: {
                            color: theme === 'dark' ? '#666666' : '#999999',
                            opacity: 0.9
                        },
                        edgeSymbol: ['circle', 'arrow'],
                        edgeSymbolSize: [4, 10],
                        data: chartData,
                        links: links
                    }
                ]
            };
            
            myChart.setOption(option);
        }
    });
});