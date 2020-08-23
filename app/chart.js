
/**********************************************
 *
 * 
 * d3js chart
 *
 **********************************************/
const width = 500;
const height = 200;
const duration = 50;
const step = 1;

function setupPlot(maxX, maxY) {
    const chart = d3.select('#chart')
        .attr('width', width + 50)
        .attr('height', height + 50);
    const xScale = d3.scaleLinear().domain([0, maxX - 1]).range([0, width]);
    const yScale = d3.scaleLinear().domain([maxY, 0]).range([height, 0]);

    const line = d3.line()
        .x(d => xScale(d.x))
        .y(d => yScale(d.y))
        .curve(d3.curveMonotoneX);

    const xAxis = d3.axisBottom().scale(xScale);
    const axisX = chart.append('g').attr('class', 'x axis')
        .attr('transform', `translate(0, ${width})`)
        .call(xAxis);
    const path = chart.append('path')
    return { axisX, xAxis, path, line }
}

function drawPlot(data, axisX, xAxis, path, line) {
    // Draw new line
    path.datum(data)
        .attr('class', 'line')
        .attr('d', line);
    axisX.transition()
        .duration(duration)
        .ease(d3.easeLinear, 2)
        .call(xAxis);
    path.attr('transform', null)
        .transition()
        .duration(duration)
        .ease(d3.easeLinear, 2)
}