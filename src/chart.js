
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
    voltMin: -1,  // in V
    voltMax: 1,   // in V
    currMin: -200,  // in uA
    currMax: 200,   // in uA
}
const INNER_WIDTH = WIDTH - MARGIN.left - MARGIN.right
const INNER_HEIGHT = HEIGHT - MARGIN.top - MARGIN.bottom

const chart = d3.select('#chart')
    .attr("width", "100%")
    .attr("height", "100%")
    .attr("viewBox", `0 0 ${WIDTH + MARGIN.left + MARGIN.right} ${HEIGHT + MARGIN.top + MARGIN.bottom}`)
    .attr("preserveAspectRatio", "xMinYMin")
    .append("g")
    .attr("transform", `translate(${MARGIN.left}, ${MARGIN.top})`)

//  Scale
const xScale = d3.scaleLinear().domain([DOMAIN.voltMin, DOMAIN.voltMax]).range([0, INNER_WIDTH])
const yScale = d3.scaleLinear().domain([DOMAIN.currMin, DOMAIN.currMax]).range([INNER_HEIGHT, 0])
const line = d3.line()
    .x(d => {
        const x = xScale(d.x)
        return (x > 0 ? x > INNER_WIDTH ? INNER_WIDTH : x : 0)
    })
    .y(d => {
        const y = yScale(d.y)
        return (y > 0 ? y > INNER_HEIGHT ? INNER_HEIGHT : y : 0)
    })
    .curve(d3.curveMonotoneX)

// Axes
const xAxis = d3.axisBottom(xScale).ticks(10);
const yAxis = d3.axisLeft(yScale).ticks(8);
const xAxisGrid = d3.axisBottom(xScale).tickSize(-INNER_HEIGHT).tickFormat('').ticks(10);
const yAxisGrid = d3.axisLeft(yScale).tickSize(-INNER_WIDTH).tickFormat('').ticks(8);



// Create axes.
chart.append('g')
    .attr('class', 'x axis')
    .attr('transform', 'translate(0,' + INNER_HEIGHT + ')')
    .call(xAxis);
chart.append('g')
    .attr('class', 'y axis')
    .call(yAxis);

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

// Create grids.
chart.append('g')
    .attr('class', 'x grid')
    .attr('transform', 'translate(0,' + INNER_HEIGHT + ')')
    .call(xAxisGrid);
chart.append('g')
    .attr('class', 'y grid')
    .call(yAxisGrid)

// path for the the plot
const path = chart.append("path") // initialize path for main curve
    .attr("class", "line")

const pointer = chart.append("g") // initialize pointer for current data point

function rescale() {
    xScale.domain([DOMAIN.voltMin, DOMAIN.voltMax]) // rescale
    yScale.domain([DOMAIN.currMin, DOMAIN.currMax]) // rescale

    // apply updated scale
    chart.selectAll(".x.grid")
        .transition().duration(500)
        .call(xAxisGrid)

    chart.selectAll(".y.grid")
        .transition().duration(500)
        .call(yAxisGrid)

    chart.selectAll(".x.axis")
        .transition().duration(500)
        .call(xAxis)

    chart.selectAll(".y.axis")
        .transition().duration(500)
        .call(yAxis)
}

function drawPlot(state) {
    const dt = []
    const cxy = {}
    const data = state.data.slice(-1)[0]
    if (state.isRunning) {
        cxy.x = xScale(data.x)
        cxy.y = yScale(data.y)
        cxy.x = cxy.x > 0
            ? cxy.x > INNER_WIDTH
                ? INNER_WIDTH
                : cxy.x
            : 0
        cxy.y = cxy.y > 0
            ? cxy.y > INNER_HEIGHT
                ? INNER_HEIGHT
                : cxy.y
            : 0
        dt.push(cxy)
    }
    pointer.selectAll("circle.pointer").remove()
        .data(dt).enter()
        .append("circle")
        .attr("class", "pointer")
        .attr("cx", d => d.x)
        .attr("cy", d => d.y)
        .attr("r", 3)

    path.datum(state.data)
        .attr("class", "line")
        .attr("d", line)
}