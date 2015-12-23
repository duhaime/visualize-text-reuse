// this script visualizes text reuse, using
// json from an ANN algorithm contained in
// /utils/. For more information, see:
// https://github.com/duhaime/visualizing-text-reuse

// width and height for the scatter plot and time axis
var margin = {top: 90, right: 420, left: 70, bottom: 40};   
var timeMargin = {top:45, right: 0, left: 5, bottom: 0};
var w = 800 - margin.left - margin.right;
var h = 345 - margin.top - margin.bottom;

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

// append selected source and target segments to the DOM
var updateText = function(d) { 
  // append the text titles to the DOM
  d3.select("#titleLeft").html( d.sourceTitle);
  d3.select("#titleRight").html( d.similarTitle);
  $.getJSON( "json/segments/segments_" + d.sourceId + ".json", function( jsonResponse ) {
    d3.select("#textLeft").html( jsonResponse[d.sourceSegment] );
  });
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

// draw the svg
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

// specify x axis range
var x = d3.scale.linear()
  .range([15, w-15]);

// draw x axis
var xAxis = d3.svg.axis()
  .scale(x)
  // limit x-axis to integers only
  .tickFormat(function(e){
     if(Math.floor(e) != e)
       {return;}
     return e;
  });

// append x axis to DOM
var xAxisGroup = svg.append("g")
  .attr("class","x axis")
  .attr("transform", "translate(" + margin.left + 
    "," + (h+margin.top) + ")");

// specify y axis range
var y = d3.scale.linear()
  .range([h-15, 15]);

// draw y axis
var yAxis = d3.svg.axis()
  .scale(y)
  .orient("left")
         
// append y axis to DOM
var yAxisGroup = svg.append("g")
  .attr("class", "y axis")
  .attr("transform", "translate(" + margin.left + "," + margin.top + ")")

// specify time axis range
var time = d3.scale.linear()
  .range([15, w+margin.right+margin.left-35]);

// draw time axis
var timeAxis = d3.svg.axis()
  .scale(time)
  // format years to remove comma from label
  .tickFormat(d3.format("d"));

// append time axis to DOM
var timeAxisGroup = svg.append("g")
  .attr("class", "time")
  .attr("transform", "translate(" + 
      (timeMargin.left) + 
      "," + (timeMargin.top) + ")");

// specify a key function
var dataKey = function(d) {
  return d.sourceId + "." + d.similarId + "." + d.similarity;
};

// main plotting function
var makeScatterPlot = function(data) {

  // specify color scheme
  var colors = d3.scale.category20();

  // reset text in the textBox
  resetText();

  // set domains for x, y, and time
  x.domain(d3.extent(data, segmentFn))
  y.domain(d3.extent(data, similarityFn))

  // update x and y axes and build time axis
  xAxisGroup.call(xAxis); 
  yAxisGroup.call(yAxis);  

  //////////////////////////
  // scatterpoint circles //
  //////////////////////////

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

  //////////////////////////////
  // legend points and labels //
  //////////////////////////////

  // retrieve one observation of each similarId
  var uniqueIds = uniquify(data);

  var legends = svg.selectAll(".legend").data(uniqueIds, dataKey); 
  var legendsUpdate = d3.transition(legends)

  legendsUpdate.select("g")
    .attr("stroke", function(d) { return colors(d.similarId) })
    .text(function(d){return d.similarTitle});

  var legendsEnter = legends.enter()                        
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

  var legendsExit = d3.transition(legends.exit())
    .remove();

  ///////////////
  // time axis //
  ///////////////

  // specify time domain 
  time.domain(d3.extent(dropdownJson, timeFn));

  // add a date to the time axis for each title being plotted 
  var yearLabels = [];
  // first add the boundary labels
  var bookendYears = d3.extent(dropdownJson, timeFn);
  for (i=0; i < bookendYears.length; i++) {
    yearLabels.push(bookendYears[i]);
  };
  // add one year label for each plotted point
  for (i = 0; i < uniqueIds.length; i++) {
    yearLabels.push(uniqueIds[i].similarYear);
  };
  timeAxis.tickValues(yearLabels);
  timeAxisGroup.call(timeAxis);

  // append circles to time axis
  var timePoints = svg.selectAll(".timePoint").data(uniqueIds, dataKey);
  var timePointsUpdate = d3.transition(timePoints)

  timePointsUpdate.select("circle")
    .attr("cx", function(d) { return time(timeFn(d))});
    
  var timePointsEnter = timePoints.enter().insert('svg:circle')
    .attr('class', 'timePoint')
    .attr('r', 4 )
    .attr('cx', function(d) { return time(d.similarYear) + timeMargin.left})
    .attr('cy', function(d) { return timeMargin.top })
    .attr('stroke', function(d) { return colors(d.similarId) });

  var timePointsExit = d3.transition(timePoints.exit())
    .remove();

  // rotate the year labels on the time axis
  d3.select(".time").selectAll("text")
    .attr("x", 23)
    .attr("y", -10)
    .attr("transform", "rotate(-65)" );

};
