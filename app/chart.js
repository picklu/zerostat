
/**********************************************
 *
 * d3js chart
 *
 **********************************************/
const margin = {
    top: 20,
    right: 20,
    bottom: 55,
    left: 80
}

// d3js chart
const plotScale = {
    voltMin: -2.5,  // in V
    voltMax: 2.5,   // in V
    currMin: -200,  // in uA
    currMax: 200,   // in uA
    tickX: 0.5,     // in V
    tickY: 50       // in uA
}

const width = 900 - margin.left - margin.right
const height = 500 - margin.top - margin.bottom



const chart = d3.select('#chart')
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform",
        "translate(" + margin.left + "," + margin.top + ")");

let xScale = d3.scaleLinear().domain([plotScale.voltMin, plotScale.voltMax]).range([0, width])
const yScale = d3.scaleLinear().domain([plotScale.currMin, plotScale.currMax]).range([height, 0])
const line = d3.line()
    .x(d => xScale(d.x))
    .y(d => yScale(d.y))
    .curve(d3.curveMonotoneX)

let data = []

// draw grids along x-axis
for (let x = plotScale.voltMin + plotScale.tickX;
    x <= plotScale.voltMax;
    x = x + plotScale.tickX) {
    data = [{ x, y: plotScale.currMin }, { x, y: plotScale.currMax }]
    drawGridXY("grid", data)
}

// draw grids along y-axis
for (let y = plotScale.currMin + plotScale.tickY;
    y <= plotScale.currMax;
    y = y + plotScale.tickY) {
    data = [{ x: plotScale.voltMin, y }, { x: plotScale.voltMax, y }]
    drawGridXY("grid", data)
}

// x = 0 line
data = [{ x: 0, y: plotScale.currMin }, { x: 0, y: plotScale.currMax }]
drawGridXY("rootXY", data)

// y = 0 line
data = [{ x: plotScale.voltMin, y: 0 }, { x: plotScale.voltMax, y: 0 }]
drawGridXY("rootXY", data)

// x-axis label
const xAxis = d3.axisBottom().scale(xScale);
chart.append('g').attr('class', 'x axis')
    .attr('transform', `translate(0, ${height})`)
    .call(xAxis)

// y-axis label
const yAxis = d3.axisLeft().scale(yScale);
chart.append('g').attr('class', 'y axis')
    .attr('transform', `translate(0, 0)`)
    .call(yAxis)

// x-axis title
chart.append("text")
    .attr("x", width / 2)
    .attr("y", height + margin.top)
    .attr("dy", "2em")
    .attr("class", "axis-title")
    .attr("text-anchor", "middle")
    .style("stroke", "none")
    .text("Voltage (V)")

// y-axis title
chart.append("text")
    .attr("transform", "rotate(-90)")
    .attr("x", 0 - (height / 2))
    .attr("y", 0 - margin.right)
    .attr("dy", "-2em")
    .attr("class", "axis-title")
    .attr("text-anchor", "middle")
    // .style("font-size", "18px")
    .style("stroke", "none")
    .text("Current (\xB5A)")

// return line, and path
const path = chart.append('path')

function rescale() {
    yScale.domain([plotScale.voltMin, plotScale.voltMax])
    d3.select("#chart")
        .select(".x.axis")
        .transition().duration(500).ease("sin-in-out")
        .call(xAxis);
}

function drawGridXY(styleClass, data) {
    chart.append('path')
        .datum(data)
        .attr("class", styleClass)
        .attr("d", line)
}

function drawPlot(data) {
    path.datum(data)
        .attr('class', 'line')
        .attr('d', line)
}