// this script visualizes text reuse, using
// json from an ANN algorithm contained in
// /utils/. For more information, see:
// https://github.com/duhaime/visualizing-text-reuse

// width and height for the scatter plot and time axis
var margin = {top: 90, right: 420, left: 70, bottom: 50};   
var timeMargin = {top:45, right: 0, left: 5, bottom: 0};
var w = 800 - margin.left - margin.right;
var h = 355 - margin.top - margin.bottom;

// function that makes the plotting call
var makePlotCall = function(sourceId){
  var alignmentsDir = "json/alignments/"; 
  var alignmentsFile = sourceId + "_alignments.json";
  var alignmentsPath = alignmentsDir + alignmentsFile
  $.getJSON( alignmentsPath, function( jsonResponse ) {
    makeScatterPlot( jsonResponse );
  });
};  


// function that takes as input an array of dicts
// [{"similarId":0,"title":"A"}...] and returns an 
// array of dicts that contains only one 
// observation for each similarId. 
var uniquify = function(arr) {
  var ids = [];
  var result = [];

  // add information on the input text first to ensure
  // the selected text appears first in the key 
  if (arr.length > 0) {
    result.push({"similarYear":arr[0].sourceYear,
        "similarId":arr[0].sourceId,
        "similarTitle":arr[0].sourceTitle}
    );
  };

  var indx=-1;
  for(var i=0; i< arr.length; i++){
    indx = ids.indexOf(arr[i].similarId);
    if(indx==-1){
      ids.push(arr[i].similarId);
      result.push(arr[i]);
    }
  }

  return result;
};

// append selected source and target segments to the DOM
var updateText = function(d) { 
  // append the text titles to the DOM
  d3.select("#titleLeft").html( d.sourceTitle);
  d3.select("#titleRight").html( d.similarTitle);
  segmentsDir = "json/segments/";
  sourceSegmentsFile = "segments_" + d.sourceId + ".json";
  sourceSegmentsPath = segmentsDir + sourceSegmentsFile;

  $.getJSON(sourceSegmentsPath, function( jsonResponse ) {
    d3.select("#textLeft").html( jsonResponse[d.sourceSegment] );
  });

  similarSegmentsFile = "segments_" + d.similarId + ".json";
  similarSegmentsPath = segmentsDir + similarSegmentsFile;

  $.getJSON(similarSegmentsPath, function( jsonResponse ) {
    d3.select("#textRight").html( jsonResponse[d.similarSegment] );
  });
};

// function to reset text upon new json selection
var resetText = function() { 
  var hintPreface = '<p style="font-weight:normal;">';
  var hintText = 'Hint: You can click on the dots.' 
  var hint = hintPreface + hintText + '</p4>'; 
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

// add a label to the x axis
xAxisLabel = svg.append("text")
    .attr("class", "x label")
    .attr("text-anchor", "end")
    .attr("x", w-15)
    .attr("y", h + margin.top + margin.bottom - 3)
    .style("font-size","14")
    .text("Passage in dropdown text");

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
  .attr("transform", "translate(" + margin.left +
     "," + margin.top + ")")

// add a label to the y axis
svg.append("text")
    .attr("class", "y label")
    .attr("text-anchor", "end")
    .attr("y", 3)
    .attr("x", -(h+margin.top-10)/2)
    .attr("dy", ".75em")
    .style("font-size", "14")
    .attr("transform", "rotate(-90)")
    .text("Passage similarity");

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

  // split data into two components
  bookendYearData = data.bookendYears.slice();
  alignmentData = data.alignments.slice();

  // specify color scheme
  var colors = d3.scale.category20();

  // reset text in the textBox
  resetText();

  // set domains for x, y, and time
  x.domain(d3.extent(alignmentData, segmentFn))
  y.domain(d3.extent(alignmentData, similarityFn))

  // update x and y axes and build time axis
  xAxisGroup.call(xAxis); 
  yAxisGroup.call(yAxis);  

  //////////////////////////
  // scatterpoint circles //
  //////////////////////////

  // specify data with key function
  var circles = svg.selectAll(".scatterPoint")
    .data(alignmentData, dataKey);
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
  var uniqueIds = uniquify(alignmentData);

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
  time.domain(d3.extent(bookendYearData));

  // add bookend years to the time axis 
  var yearLabels = bookendYearData;
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
