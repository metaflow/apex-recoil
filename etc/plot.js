function updateGraph(x, median, best, count) {
    const data = [{
        x: x,
        y: median.map(v => 101 - v),
        text: median,
        name: 'median',
        hovertemplate: '%{text}',
        mode: 'lines',
    }, {
        x: x,
        y: best.map(v => 101 - v),
        name: 'best',
        text: best,
        hovertemplate: '%{text}',
        mode: 'lines',
    },
    {
        x: x,
        y: count,
        name: 'tries',
        yaxis: 'y2',
        type: 'scatter',
        mode: 'markers',
    },
    ];
    const yticks = [1, 2, 3, 5, 7, 9, 11, 21, 31, 41, 61, 81, 101];
    const layout = {
        margin: { t: 30, l: 60, r: 60, b: 80 },
        paper_bgcolor: '#171717',
        plot_bgcolor: '#171717',
        legend: {
            orientation: 'h',
            y: -0.2,
        },
        xaxis: {
            color: '#F9F9F9',
            showgrid: false,
            showline: false,
            zeroline: false,
            type: 'date',
            // tickangle: -90,
        },
        yaxis: {
            title: 'score',
            color: '#F9F9F9',
            showgrid: false,
            range: [2.1, 0],
            zeroline: false,
            type: 'log',
            tickmode: "array", // If "array", the placement of the ticks is set via `tickvals` and the tick text is `ticktext`.
            tickvals: yticks,
            ticktext: yticks.map(v => 101 - v),
        },
        yaxis2: {
            color: '#F9F9F9',
            overlaying: 'y',
            side: 'right',
            title: 'tries',
            rangemode: 'tozero',
            zeroline: false,
        }
    };
    const config = { responsive: true };
    Plotly.newPlot('plotly_area', data, layout, config);
}