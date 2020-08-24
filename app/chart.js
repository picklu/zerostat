
/**********************************************
 *
 * d3js chart
 *
 **********************************************/
const width = 900
const height = 450
const duration = 50

function setupPlot(ps) {
    const chart = d3.select('#chart')
        .attr('width', width)
        .attr('height', height)

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


    // return axis, line, and path
    const xAxis = d3.axisBottom().scale(xScale);
    const axisX = chart.append('g').attr('class', 'x axis')
        .attr('transform', `translate(0, ${width})`)
        .call(xAxis)
    const path = chart.append('path')
    return { axisX, xAxis, path, line }
}

function drawGridXY(chart, line, styleClass, data) {
    chart.append('path')
        .datum(data)
        .attr("class", styleClass)
        .attr("d", line)
}

function drawPlot(data, axisX, xAxis, path, line) {
    path.datum(data)
        .attr('class', 'line')
        .attr('d', line)
    axisX.transition()
        .duration(duration)
        .ease(d3.easeLinear, 2)
        .call(xAxis)
    path.attr('transform', null)
        .transition()
        .duration(duration)
        .ease(d3.easeLinear, 2)
}