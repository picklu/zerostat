
/**********************************************
 *
 * d3js chart
 *
 **********************************************/
const WIDTH = 900
const HEIGHT = 500
const MARGIN = {
    top: 20,
    right: 20,
    bottom: 55,
    left: 80
}
const DOMAIN = {
    voltMin: -2.5,  // in V
    voltMax: 2.5,   // in V
    currMin: -200,  // in uA
    currMax: 200,   // in uA
    tickX: 0.5,     // in V
    tickY: 50       // in uA
}
const INNER_WIDTH = WIDTH - MARGIN.left - MARGIN.right
const INNER_HEIGHT = HEIGHT - MARGIN.top - MARGIN.bottom

const chart = d3.select('#chart')
    .attr("width", WIDTH)
    .attr("height", HEIGHT)
    .append("g")
    .attr("transform", `translate(${MARGIN.left}, ${MARGIN.top})`)

const xScale = d3.scaleLinear().domain([DOMAIN.voltMin, DOMAIN.voltMax]).range([0, INNER_WIDTH])
const yScale = d3.scaleLinear().domain([DOMAIN.currMin, DOMAIN.currMax]).range([INNER_HEIGHT, 0])
const line = d3.line()
    .x(d => xScale(d.x))
    .y(d => yScale(d.y))
    .curve(d3.curveMonotoneX)

const xAxis = d3.axisBottom().scale(xScale)
const yAxis = d3.axisLeft().scale(yScale)


// x-axis label
chart.append('g').attr('class', 'x axis')
    .attr('transform', `translate(0, ${INNER_HEIGHT})`)
    .call(xAxis)

// y-axis label
chart.append('g').attr('class', 'y axis')
    .attr('transform', `translate(0, 0)`)
    .call(yAxis)

// x-axis title
chart.append("text")
    .attr("x", INNER_WIDTH / 2)
    .attr("y", INNER_HEIGHT + MARGIN.top)
    .attr("dy", "2em")
    .attr("class", "axis-title")
    .attr("text-anchor", "middle")
    .style("stroke", "none")
    .text("Voltage (V)")

// y-axis title
chart.append("text")
    .attr("transform", "rotate(-90)")
    .attr("x", 0 - (INNER_HEIGHT / 2))
    .attr("y", 0 - MARGIN.right)
    .attr("dy", "-2em")
    .attr("class", "axis-title")
    .attr("text-anchor", "middle")
    .style("stroke", "none")
    .text("Current (\xB5A)")

// path for the the plot
let path = chart.append("path") // initialize path
    .attr("class", "line")

function rescale() {
    xScale.domain([DOMAIN.voltMin, DOMAIN.voltMax]) // rescale
    chart.selectAll(".x.grid").remove() // remove grid lines
    chart.selectAll(".x.root").remove() // remove root lines

    yScale.domain([DOMAIN.currMin, DOMAIN.currMax]) // rescale
    chart.selectAll(".y.grid").remove() // remove grid lines
    chart.selectAll(".y.root").remove() // remove root lines

    chart.selectAll("path.line").remove() // remove path of the curve

    // apply updated scale
    chart.selectAll(".x")
        .transition().duration(500)
        .call(xAxis)

    chart.selectAll(".y")
        .transition().duration(500)
        .call(yAxis)

    // reassign path
    path = chart.append("path") // recreate path for the curve
        .attr("class", "line")
}

function drawGridXY(styleClass, data) {
    chart.append('path')
        .datum(data)
        .attr("class", styleClass)
        .attr("d", line)
}

function drawPlot(data) {
    path.datum(data)
        .attr("class", "line")
        .attr("d", line)
}