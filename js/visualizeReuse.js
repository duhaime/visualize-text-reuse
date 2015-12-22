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

// populate dropdown with json options
$.getJSON( "json/dropdown.json", function( jsonResponse ) {
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

// width and height
var margin = {top: 20, right: 400, left: 40, bottom: 40}   
var w = 750 - margin.left - margin.right;
var h = 270 - margin.top - margin.bottom;

var x = d3.scale.linear()
  .range([15, w-15]);

var y = d3.scale.linear()
  .range([h-15, 15]);

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

// draw y axis
var yAxis = d3.svg.axis()
  .scale(y)
  .orient("left")
         
// append y-axis to svg
var yAxisGroup = svg.append("g")
  .attr("class", "y axis")
  .attr("transform", "translate(" + margin.left + "," + margin.top + ")")

// draw line on which to plot publication dates
var publicationLine = svg.append("line")
  .attr("x1", 5)
  .attr("y1", 5)
  .attr("x2", 50)
  .attr("y2", 50)
  .attr("stroke-width",2)
  .attr("stroke", "#000000");

// use d.similarId+d.similarity as key function
var dataKey = function(d) {
  return d.similarId + d.similarity;
};

// main plotting function
var makeScatterPlot = function(data) {

  // specify color scheme
  var colors = d3.scale.category20();

  // reset text in the textBox
  resetText();

  // set x and y domains
  x.domain(d3.extent(data, segmentFn))
  y.domain(d3.extent(data, similarityFn))

  // update x and y axes
  xAxisGroup.call(xAxis); 
  yAxisGroup.call(yAxis);  

  // specify data with key function
  var circles = svg.selectAll("circle").data(data, dataKey);
  circles.transition(500)
    .attr("cx", function(d) { return x(segmentFn(d)) + margin.left })
    .attr("cy", function(d) { return x(similarityFn(d)) + margin.top })
    .attr("stroke", function(d) {return colors(d.similarId)})
    .attr("class", "scatterPoint")

  circles.enter()
    .append("svg:circle")
    .attr("r", 4)
    .attr("similarity", function(d) { return d.similarity})
    .attr("cx", function(d) { return x(segmentFn(d)) + margin.left })
    .attr("cy", function(d) { return y(similarityFn(d)) + margin.top })
    .attr("style", "cursor: pointer;")
    .attr("stroke", function(d) {return colors(d.similarId)})
    .on("click", function(d) {
      updateText(d)
    });
 
  circles.exit().remove();

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
