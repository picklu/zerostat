
/**********************************************
 *
 * d3js chart
 *
 **********************************************/
const domChartWindow = document.getElementById("chart-window")
const domChart = document.getElementById("chart")

const margin = {
    top: 15,
    bottom: 70,
    left: 80,
    right: 15,
    offset: 10
}
const domain = {
    voltMin: -1,    // in V
    voltMax: 1,     // in V
    currMin: -200,  // in uA
    currMax: 200,   // in uA
}

let chart = {}

// redraw the plot on viewport change
function redraw() {
    const width = domChartWindow.clientWidth
    const height = domChartWindow.clientHeight
    const innerWidth = width - margin.left - margin.right - margin.offset
    const innerHeight = height - margin.top - margin.bottom - margin.offset

    if (chart.dom) {
        chart.dom.selectAll(".x").remove()
        chart.dom.selectAll(".y").remove()
        chart.dom.selectAll(".line").remove()
        chart.dom.selectAll(".pointer").remove()
        chart.dom.selectAll(".axis-title").remove()
    }

    chart.dom = d3.select(domChart)
        .append("g")
        .attr("transform", `translate(${margin.left}, ${margin.top})`)

    //  Scale
    chart.xScale = d3.scaleLinear().domain([domain.voltMin, domain.voltMax]).range([0, innerWidth])
    chart.yScale = d3.scaleLinear().domain([domain.currMin, domain.currMax]).range([innerHeight, 0])
    chart.line = d3.line()
        .x(d => {
            const x = chart.xScale(d.x)
            return (x > 0 ? x > innerWidth ? innerWidth : x : 0)
        })
        .y(d => {
            const y = chart.yScale(d.y)
            return (y > 0 ? y > innerHeight ? innerHeight : y : 0)
        })
        .curve(d3.curveMonotoneX)

    // Axes
    chart.xAxis = d3.axisBottom(chart.xScale).ticks(10);
    chart.yAxis = d3.axisLeft(chart.yScale).ticks(8);
    chart.xAxisGrid = d3.axisBottom(chart.xScale).tickSize(-innerHeight).tickFormat('').ticks(10);
    chart.yAxisGrid = d3.axisLeft(chart.yScale).tickSize(-innerWidth).tickFormat('').ticks(8);

    // Create axes.
    chart.dom.append("g")
        .attr("class", "x axis")
        .attr("transform", `translate(0, ${innerHeight})`)
        .call(chart.xAxis);
    chart.dom.append("g")
        .attr("class", "y axis")
        .call(chart.yAxis);

    // x-axis title
    chart.dom.append("text")
        .attr("x", innerWidth / 2)
        .attr("y", innerHeight + margin.top)
        .attr("dy", "2em")
        .attr("class", "axis-title")
        .attr("text-anchor", "middle")
        .style("stroke", "none")
        .text("Voltage (V)")

    // y-axis title
    chart.dom.append("text")
        .attr("transform", "rotate(-90)")
        .attr("x", 0 - (innerHeight / 2))
        .attr("y", 0 - margin.right)
        .attr("dy", "-2em")
        .attr("class", "axis-title")
        .attr("text-anchor", "middle")
        .style("stroke", "none")
        .text("Current (\xB5A)")

    // Create grids.
    chart.dom.append("g")
        .attr("class", "x grid")
        .attr("transform", `translate(0, ${innerHeight})`)
        .call(chart.xAxisGrid);
    chart.dom.append("g")
        .attr("class", "y grid")
        .call(chart.yAxisGrid)

    // path for the the plot
    chart.path = chart.dom.append("path") // initialize path for main curve
        .attr("class", "line")

    chart.pointer = chart.dom.append("g") // initialize pointer for current data point

}

// function for rescanling on domain change
function rescale() {
    chart.xScale.domain([domain.voltMin, domain.voltMax]) // rescale
    chart.yScale.domain([domain.currMin, domain.currMax]) // rescale

    // apply updated scale
    chart.dom.selectAll(".x.grid")
        .transition().duration(500)
        .call(chart.xAxisGrid)

    chart.dom.selectAll(".y.grid")
        .transition().duration(500)
        .call(chart.yAxisGrid)

    chart.dom.selectAll(".x.axis")
        .transition().duration(500)
        .call(chart.xAxis)

    chart.dom.selectAll(".y.axis")
        .transition().duration(500)
        .call(chart.yAxis)
}

// function for drawing plot
function draw(state) {
    const dt = []
    const cxy = {}

    if (state.data.length) {
        const data = state.data.slice(-1)[0]
        cxy.x = chart.xScale(data.x)
        cxy.y = chart.yScale(data.y)
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
    chart.pointer.selectAll("circle.pointer").remove()
        .data(dt).enter()
        .append("circle")
        .attr("class", "pointer")
        .attr("cx", d => d.x)
        .attr("cy", d => d.y)
        .attr("r", 3)

    chart.path.datum(state.data)
        .attr("class", "line")
        .attr("d", chart.line)
}

// Redraw based on the new size whenever the browser window is resized.
redraw()
window.addEventListener("resize", () => {
    redraw()
    draw(state)
})