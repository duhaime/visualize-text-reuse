// this script visualizes text reuse, using
// json from an ANN algorithm contained in
// /utils/. For more information, see:
// https://github.com/duhaime/visualizing-text-reuse

// function that makes the plotting call
var makePlotCall = function(sourceId){
  var jsonDir = "json/alignments/"; 
  var jsonFile = sourceId + "_alignments.json";
  var jsonPath = jsonDir + jsonFile
  $.getJSON( jsonPath, function( jsonResponse ) {
    var sliced_data = jsonResponse.slice();
    makeScatterPlot( sliced_data );
  });
};  

// pass dropdownJson into global scope;
var dropdownJson;

// populate dropdown with json options
$.getJSON( "json/dropdown.json", function( jsonResponse ) {
  dropdownJson = jsonResponse;
  $.each(jsonResponse, function (key, value) {
    $("#textSelector").append($('<option></option>').val(value.id).html(value.name));
  });
  // initialize scatterplot
  makePlotCall( $("#textSelector").val() ); 
});

// event handler for change of dropdown
$('#textSelector').change(function () {
  makePlotCall( $(this).val() );
});

// function that takes as input an array of dicts
// [{"similarId":0,"title":"A","similarId":"title":"B"}] 
// and returns an array of dicts that contains only one 
// observation for each similarId. 
var uniquify = function(arr) {
  var ids = [];
  var result = [];
  var indx=-1;
  for(var i=0; i< arr.length; i++){
    indx = ids.indexOf(arr[i].similarId);
    if(indx==-1){
      ids.push(arr[i].similarId);
      result.push(arr[i]);
    }
  }
  arr = result;
  return arr
};

// function for appending text to the text divs
var updateText = function(d) { 
  // append the text titles to the DOM
  d3.select("#titleLeft").html( d.sourceTitle);
  d3.select("#titleRight").html( d.similarTitle);

  // retrieve source segment
  $.getJSON( "json/segments/segments_" + d.sourceId + ".json", function( jsonResponse ) {
    d3.select("#textLeft").html( jsonResponse[d.sourceSegment] );
  });
  // retrieve similar segment
  $.getJSON( "json/segments/segments_" + d.similarId + ".json", function( jsonResponse ) {
    d3.select("#textRight").html( jsonResponse[d.similarSegment] );
  });
};

// function to reset text upon new json selection
var resetText = function() { 
  var hint = '<p style="font-weight:normal;">Hint: You can click on the dots.</p4>'; 
  d3.select("#titleLeft").html(hint);
  d3.select("#titleRight").html("");
  d3.select("#textLeft").html("");
  d3.select("#textRight").html("");
}; 
 
// plotting helper functions
var similarityFn = function(d) { return d.similarity }
var segmentFn = function(d) { return d.sourceSegment }
var timeFn = function(d) { return d.year }

// width and height
var margin = {top: 0, right: 400, left: 40, bottom: 25}   
var w = 750 - margin.left - margin.right;
var h = 250 - margin.top - margin.bottom;

var svg = d3.select("#scatterPlot").append("svg:svg")
  .attr("width", w + margin.left + margin.right)
  .attr("height", h + margin.top + margin.bottom);

// select a subregion of the svg to create a dropbox
var graphBox = svg.append("rect")
  .attr("id", "graphBox")
  .attr("x", margin.left)
  .attr("y", margin.top)
  .attr("height", h)
  .attr("width", w)
  .attr("stroke", "#c4c4c4")
  .attr("stroke-width", 1)
  .attr("fill", "#ffffff");

var x = d3.scale.linear()
  .range([15, w-15]);

// draw x-axis
var xAxis = d3.svg.axis()
  .scale(x)
  // limit x-axis to integers only
  .tickFormat(function(e){
     if(Math.floor(e) != e)
       {return;}
     return e;
  });

// append x-axis to svg
var xAxisGroup = svg.append("g")
  .attr("class","x axis")
  .attr("transform", "translate(" + margin.left + "," + (h+margin.top) + ")");

var y = d3.scale.linear()
  .range([h-15, 15]);

// draw y axis
var yAxis = d3.svg.axis()
  .scale(y)
  .orient("left")
         
// append y-axis to svg
var yAxisGroup = svg.append("g")
  .attr("class", "y axis")
  .attr("transform", "translate(" + margin.left + "," + margin.top + ")")

// use d.similarId + "." + d.similarity as key function
var dataKey = function(d) {
  return d.sourceId + "." + d.similarId + "." + d.similarity;
};

// main plotting function
var makeScatterPlot = function(data) {

  // specify color scheme
  var colors = d3.scale.category20();

  // reset text in the textBox
  resetText();

  // create publication date axis
  var time = d3.scale.linear()
    .range([15, margin.right-35]);

  // draw publication date axis
  var timeAxis = d3.svg.axis()
    .scale(time)
    // format years to remove comma from label
    .tickFormat(d3.format("d"))
    // explicitly create ticks at region beginning and ending
    .tickValues(d3.extent(dropdownJson, timeFn));

  // append publication date axis to graph
  var timeAxisGroup = svg.append("g")
    .attr("class", "axisTwo")
    .attr("transform", "translate(" + 
        (margin.right-margin.left) + 
        "," + (h+margin.top) + ")");

  // set domains for x, y, and time
  x.domain(d3.extent(data, segmentFn))
  y.domain(d3.extent(data, similarityFn))
  time.domain(d3.extent(dropdownJson, timeFn));

  // update x and y axes
  xAxisGroup.call(xAxis); 
  yAxisGroup.call(yAxis);  
  //timeAxisGroup.call(timeAxis);

  // specify data with key function
  var circles = svg.selectAll(".scatterPoint").data(data, dataKey);
  var circlesUpdate = d3.transition(circles)

  circlesUpdate.select("circle")
    .attr("cx", function(d) { return x(segmentFn(d)) + margin.left })
    .attr("cy", function(d) { return x(similarityFn(d)) + margin.top })
    .attr("stroke", function(d) {return colors(d.similarId)})
    .attr("class", "scatterPoint")
    .attr("similarId", function(d) { return d.similarId})
    .attr("similarSegment", function(d) { return d.similarSegment });
 
  var circlesEnter = circles.enter().insert("svg:circle")
    .attr("class", "scatterPoint")
    .attr("similarId", function(d) { return d.similarId})
    .attr("similarSegment", function(d) { return d.similarSegment })
    .attr("r", 4)
    .attr("similarity", function(d) { return d.similarity})
    .attr("cx", function(d) { return x(segmentFn(d)) + margin.left })
    .attr("cy", function(d) { return y(similarityFn(d)) + margin.top })
    .attr("style", "cursor: pointer;")
    .attr("stroke", function(d) {return colors(d.similarId)})
    .on("click", function(d) {
      updateText(d)
    });
 
  var circlesExit = d3.transition(circles.exit())
    .remove();

  // retrieve one observation of each similarId
  var uniqueIds = uniquify(data);

  var legends = svg.selectAll(".legend").data(uniqueIds, dataKey); 
  legends.transition(500)
    .attr("stroke", function(d) { return colors(d.similarId) })
    .text(function(d){return d.similarTitle});

  legends.enter()                                           
    .append('g')                                           
    .attr('class', 'legend')                                
    .each(function(d, i) {
      var g = d3.select(this);
      g.append("svg:circle")
        .attr("cx", w + margin.left + 24)
        .attr("cy", 20*i+15 + margin.top)
        .attr("r", 4)
        .style("stroke", function(d){return colors(d.similarId)});
        
      g.append("text")
        .attr("x", w + margin.left + 32)
        .attr("y", 20*i + 20 + margin.top)
        .attr("height",20)
        .attr("width",60)
        .style("fill", "#000000")
        .text(function(d){return d.similarTitle});      
    });
  legends.exit().remove();
};
