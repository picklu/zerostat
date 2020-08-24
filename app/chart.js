
/**********************************************
 *
 * d3js chart
 *
 **********************************************/
const width = 900
const height = 450
const duration = 100

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

    const xAxis = d3.axisBottom().scale(xScale);
    const axisX = chart.append('g').attr('class', 'x axis')
        .attr('transform', `translate(0, ${width})`)
        .call(xAxis)
    const path = chart.append('path')
    return { axisX, xAxis, path, line }
}

function drawGridXY(chart, data) {
    chart.append('path')
        .datum(data)
        .attr("class", "grid")
        .attr("d", "line")
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