
/**********************************************
 *
 * d3js chart
 *
 **********************************************/
let resize
let width = 960
let height = 500
const margin = {
    top: 15,
    bottom: 20,
    left: 90,
    right: 10
}
const domain = {
    voltMin: -1,    // in V
    voltMax: 1,     // in V
    currMin: -200,  // in uA
    currMax: 200,   // in uA
}


const innerWidth = width - margin.left - margin.right
const innerHeight = height - margin.top - margin.bottom

const chart = d3.select('#chart')
    .attr("viewBox", `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom} `)
    .attr("preserveAspectRatio", "xMidYMid meet")
    .append("g")
    .attr("transform", `translate(${margin.left}, ${margin.top})`)

//  Scale
const xScale = d3.scaleLinear().domain([domain.voltMin, domain.voltMax]).range([0, innerWidth])
const yScale = d3.scaleLinear().domain([domain.currMin, domain.currMax]).range([innerHeight, 0])
const line = d3.line()
    .x(d => {
        const x = xScale(d.x)
        return (x > 0 ? x > innerWidth ? innerWidth : x : 0)
    })
    .y(d => {
        const y = yScale(d.y)
        return (y > 0 ? y > innerHeight ? innerHeight : y : 0)
    })
    .curve(d3.curveMonotoneX)

// Axes
const xAxis = d3.axisBottom(xScale).ticks(10);
const yAxis = d3.axisLeft(yScale).ticks(8);
const xAxisGrid = d3.axisBottom(xScale).tickSize(-innerHeight).tickFormat('').ticks(10);
const yAxisGrid = d3.axisLeft(yScale).tickSize(-innerWidth).tickFormat('').ticks(8);



// Create axes.
chart.append('g')
    .attr('class', 'x axis')
    .attr('transform', 'translate(0,' + innerHeight + ')')
    .call(xAxis);
chart.append('g')
    .attr('class', 'y axis')
    .call(yAxis);

// x-axis title
chart.append("text")
    .attr("x", innerWidth / 2)
    .attr("y", innerHeight + margin.top)
    .attr("dy", "2em")
    .attr("class", "axis-title")
    .attr("text-anchor", "middle")
    .style("stroke", "none")
    .text("Voltage (V)")

// y-axis title
chart.append("text")
    .attr("transform", "rotate(-90)")
    .attr("x", 0 - (innerHeight / 2))
    .attr("y", 0 - margin.right)
    .attr("dy", "-2em")
    .attr("class", "axis-title")
    .attr("text-anchor", "middle")
    .style("stroke", "none")
    .text("Current (\xB5A)")

// Create grids.
chart.append('g')
    .attr('class', 'x grid')
    .attr('transform', 'translate(0,' + innerHeight + ')')
    .call(xAxisGrid);
chart.append('g')
    .attr('class', 'y grid')
    .call(yAxisGrid)

// path for the the plot
const path = chart.append("path") // initialize path for main curve
    .attr("class", "line")

const pointer = chart.append("g") // initialize pointer for current data point

function rescale() {
    xScale.domain([domain.voltMin, domain.voltMax]) // rescale
    yScale.domain([domain.currMin, domain.currMax]) // rescale

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
            ? cxy.x > innerWidth
                ? innerWidth
                : cxy.x
            : 0
        cxy.y = cxy.y > 0
            ? cxy.y > innerHeight
                ? innerHeight
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