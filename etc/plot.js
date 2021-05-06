function updateGraph(x, median, best, count) {
    const data = [{
        x: x,
        y: median,
        name: 'median',
    }, {
        x: x,
        y:best,
        name: 'best',
    },
    {
        x: x,
        y: count,
        name: 'tries',
        yaxis: 'y2',
    },
];
    const layout = {
        margin: {t: 30, l:60, r: 60, b:80},
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
            range: [0, 100],
            zeroline: false,
        },
        yaxis2: {
            color: '#F9F9F9',
            overlaying: 'y',
            side: 'right',
            title: 'tries',
        }
    };
    const config = { responsive: true };
    Plotly.newPlot('plotly_area', data, layout, config);
}