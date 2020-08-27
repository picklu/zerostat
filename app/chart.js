
/**********************************************
 *
 * d3js chart
 *
 **********************************************/
const margin = {
    top: 20,
    right: 20,
    bottom: 50,
    left: 70
}
const width = 900 - margin.left - margin.right
const height = 500 - margin.top - margin.bottom
const duration = 50


function setupPlot(ps) {
    const chart = d3.select('#chart')
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform",
            "translate(" + margin.left + "," + margin.top + ")");

    const xScale = d3.scaleLinear().domain([ps.voltMin, ps.voltMax]).range([0, width])
    const yScale = d3.scaleLinear().domain([ps.currMin, ps.currMax]).range([height, 0])
    const line = d3.line()
        .x(d => xScale(d.x))
        .y(d => yScale(d.y))
        .curve(d3.curveMonotoneX)

    let data = []

    // draw grids along x-axis
    for (let x = ps.voltMin; x <= ps.voltMax; x = x + ps.tickX) {
        data = [{ x, y: ps.currMin }, { x, y: ps.currMax }]
        drawGridXY(chart, line, "grid", data)
    }

    // draw grids along y-axis
    for (let y = ps.currMin; y <= ps.currMax; y = y + ps.tickY) {
        data = [{ x: ps.voltMin, y }, { x: ps.voltMax, y }]
        drawGridXY(chart, line, "grid", data)
    }

    // x = 0 line
    data = [{ x: 0, y: ps.currMin }, { x: 0, y: ps.currMax }]
    drawGridXY(chart, line, "rootXY", data)

    // y = 0 line
    data = [{ x: ps.voltMin, y: 0 }, { x: ps.voltMax, y: 0 }]
    drawGridXY(chart, line, "rootXY", data)

    // x-axis label
    const xAxis = d3.axisBottom().scale(xScale);
    chart.append('g').attr('class', 'x axis')
        .attr('transform', `translate(0, ${height / 2})`)
        .call(xAxis)

    // y-axis label
    const yAxis = d3.axisLeft().scale(yScale);
    chart.append('g').attr('class', 'y axis')
        .attr('transform', `translate(${width / 2}, 0)`)
        .call(yAxis)

    // return line, and path
    const path = chart.append('path')
    return { path, line }
}

function drawGridXY(chart, line, styleClass, data) {
    chart.append('path')
        .datum(data)
        .attr("class", styleClass)
        .attr("d", line)
}

function drawPlot(data, path, line) {
    path.datum(data)
        .attr('class', 'line')
        .attr('d', line)

    path.attr('transform', null)
        .transition()
        .duration(duration)
        .ease(d3.easeLinear, 2)
}