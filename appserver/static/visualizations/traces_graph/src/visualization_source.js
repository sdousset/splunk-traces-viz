/*
 * Visualization source
 */

class TreeNodeModel {

    constructor(id, name, parentName, latency, duration, parent, nbRequests, nbErrors){
        this.id = id;
        this.name = name;
        this.parentName = parentName;
        this.latency = latency;
        this.duration = duration;
        this.nbRequests = nbRequests;
        this.nbErrors = nbErrors;
        this.errorRate = Math.round((nbErrors / nbRequests) * 100) / 100 ;

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
let maxDelay;
let nbRequestsQ1;
let nbRequestsQ3;

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

            let mandatoryFields = ["traceId", "id", "parentId", "name", "timestamp"];
            let fieldsName = data.fields.map(field => field.name);
            
            let isOneFieldMissing = false;
            let missingField = "";

            for(let i = 0 ; i < mandatoryFields.length && !isOneFieldMissing ; i++){
                if(fieldsName.find(fieldName => mandatoryFields[i] == fieldName) === undefined){
                    isOneFieldMissing = true;
                    missingField = mandatoryFields[i];
                }
            }
            
            // if (isOneFieldMissing) {
            //     throw new SplunkVisualizationBase.VisualizationError("Missing at least one mandatory field. Missing: \'" + missingField + "\'");
            // }

            return data;
        },
  
        // Implement updateView to render a visualization.
        //  'data' will be the data object returned from formatData or from the search
        //  'config' will be the configuration property object
        updateView: function(data, config) {

            // Initialize chart with DOM
            myChart = echarts.init(this.el);
            var option = {};
            width =  myChart._dom.clientWidth;
            height = myChart._dom.clientHeight;
            // Getting conf / format menu properties if exists
            maxDelay = config[this.getPropertyNamespaceInfo().propertyNamespace + 'maxDelay'] || 2000;

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
                backgroundColor: '#000000',
                darkMode: true,
                series: [
                    {
                        type: 'graph',
                        layout: 'none',
                        // Nodes configuration and styling
                        symbol: 'circle',
                        itemStyle: {
                            color: '#333333',
                            borderColor: '#999999',
                            borderWidth: 2,
                        },
                        label: {
                            show: true,
                            position: 'bottom'
                        },
                        // Links and edges configuration and styling
                        lineStyle: {
                            opacity: 0.9,
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
                tmp = parseInt(nodes[i].nbRequests);
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
                parseFloat(masterNode.avgLatency),
                parseFloat(masterNode.avgDuration),
                null, parseInt(masterNode.nbRequests),
                parseInt(masterNode.nbErrors)
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
                            parseFloat(n.avgLatency),
                            parseFloat(n.avgDuration),
                            node,
                            parseInt(n.nbRequests),
                            parseInt(n.nbErrors)
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

            // Node size and link width depending on nbRequests
            let symbolSize = 35;
            let lineStyle = {};
            lineStyle.width = 2;
            lineStyle.type = [20, 3];

            if (node.nbRequests < nbRequestsQ1) {
                symbolSize = 20;
                lineStyle.width = 1;
                lineStyle.type = [10, 2];
            }
            else if (node.nbRequests > nbRequestsQ3) {
                symbolSize = 60;
                lineStyle.width = 4;
                lineStyle.type = [35, 3];
            }
            
            // Node color depending on error rate
            let itemStyle = {};
            let tooltip = {
                formatter: '{b}'
                + '<br/> requests: ' + node.nbRequests
            };
            let nodeLabel = {}
            if (node.errorRate > 0.2) {
                itemStyle = {
                    color: '#CD3C14',
                    shadowColor: '#CD3C14',
                    shadowBlur: 10
                };
                tooltip = {
                    formatter: '{b}' 
                    + '<br/> error rate: '+ Math.round(node.errorRate * 100) / 100
                    + '<br/> errors: ' + node.nbErrors
                    + '<br/> requests: ' + node.nbRequests
                    
                };
            }
            
            else if(node.errorRate > 0.05 && node.errorRate <= 0.2) {
                itemStyle = {
                    color: '#FF7900',
                    shadowColor: '#FF7900',
                    shadowBlur: 10
                };
                tooltip = {
                    formatter: '{b}' 
                    + '<br/> error rate: '+ Math.round(node.errorRate * 100) / 100
                    + '<br/> errors: ' + node.nbErrors
                    + '<br/> requests: ' + node.nbRequests
                    
                };
            }
            
            // Pushing the node to the graph
            data.push({
                id: node.id,
                name: node.name,
                x: node.x * levelWidth,
                y: node.finalY * levelHeight,
                itemStyle: itemStyle,
                tooltip: tooltip,
                label: nodeLabel,
                symbolSize: symbolSize
            });
            
            // Links
            if (node.parent) {

                // Color link
                if (node.errorRate > 0.2) {
                    lineStyle.color = '#CD3C14';
                }
                else if(node.errorRate > 0.05 && node.errorRate <= 0.2) {
                    lineStyle.color = '#FF7900';
                }

                let delay = node.latency;
                let label = {
                    show: true,
                    formatter: function(fdata) {
                        let timeUnit = 'ms';
                        if (delay > 1000) {
                            delay = delay / 1000;
                            timeUnit = 's';
                        }
                        else if (delay < 1) {
                            delay = delay * 1000;
                            timeUnit = 'µs';
                        }
                        return Math.round(delay * 100) / 100 + ' ' + timeUnit;
                    }
                }

                // Color label link if delay too long
                if(delay > maxDelay){
                    label.fontWeight = 'bold';
                    label.fontSize = 20;
                    label.color = '#cd3c14';
                }

                //Push link to list
                links.push({
                    source: node.parent.id.toString(),
                    target: node.id.toString(),
                    label: label,
                    lineStyle: lineStyle
                })
            }

            for (let i = 0; i < node.children.length; i++) {
                this.createGraphNodesAndLinks(node.children[i], data, links, levelWidth, levelHeight);
            }
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
                backgroundColor: '#000000',
                darkMode: true,
                series: [
                    {
                        type: 'graph',
                        layout: 'none',
                        // Nodes configuration and styling
                        symbol: 'circle',
                        itemStyle: {
                            color: '#333333',
                            borderColor: '#999999',
                            borderWidth: 2,
                        },
                        label: {
                            show: true,
                            position: 'bottom'
                        },
                        // Links and edges configuration and styling
                        lineStyle: {
                            type: 'dashed',
                            opacity: 0.9,
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