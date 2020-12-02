import PrometheusQuery from 'prometheus-query';
import datasource from './datasource';
import opt from './options';
import {
    setTimeAxesOptions
} from './axes';

export default {
    id: 'datasource-prometheus',

    beforeInit: (chart) => {
        chart['datasource-prometheus'] = {
            'loading': false,
        };
    },

    afterInit: (chart, options) => {
        opt.assertPluginOptions(options); // triggers exceptions

        // auto update
        if (!!options && !!options['timeRange'] && !!options['timeRange']['msUpdateInterval'])
            chart['datasource-prometheus']['updateInterval'] = setInterval(() => {
                chart.update();
            }, options['timeRange']['msUpdateInterval']);
    },

    beforeUpdate: (chart, options) => {
        const _options = opt.defaultOptionsValues(options);

        if (!!chart['datasource-prometheus'] && chart['datasource-prometheus']['loading'] == true)
            return true;

        const prometheus = _options['prometheus'];
        const query = _options['query'];
        const {
            start,
            end
        } = datasource.getStartAndEndDates(_options['timeRange'])
        const expectedStep = _options['timeRange']['step'] || datasource.getPrometheusStepAuto(start, end, chart.width);
        const minStep = (_options.minStep || expectedStep);
        const step = minStep >= expectedStep ? minStep : expectedStep;
        if (!!chart['datasource-prometheus'] &&
        chart['datasource-prometheus']['step'] == step &&
        chart['datasource-prometheus']['start'] == start &&
        chart['datasource-prometheus']['end'] == end)
            return true;

        chart['datasource-prometheus']['step'] = step;
        chart['datasource-prometheus']['start'] = start;
        chart['datasource-prometheus']['end'] = end;

        const pq = new PrometheusQuery(prometheus);

        pq.rangeQuery(query, start, end, step)
            .then((res) => {
                if (res.result.length > 0) {
                    var isHiddenMap = {};
                    if (chart.data.datasets.length > 0) {
                        for(var oldDataSetKey in chart.data.datasets){
                            var oldDataSet = chart.data.datasets[oldDataSetKey];
                            var metaIndex = 0;
                            for (var id in oldDataSet._meta ){ metaIndex = id; }
                            isHiddenMap[oldDataSet.label] = !chart.isDatasetVisible(oldDataSet._meta[metaIndex].index);
                        }
                    }

                    chart.data.datasets = res.result.map((serie, i) => {
                        return {
                            lineTension: _options.lineTension || 0.4,
                            stepped: _options.stepped || false,
                            cubicInterpolationMode: _options.cubicInterpolationMode || 'default',
                            fill: _options.fill || false,
                            label: selectLabel(_options, serie, i),
                            data: serie.values.map((v, j) => {
                                return {
                                    t: v.time,
                                    y: v.value,
                                };
                            }),
                            backgroundColor: selectBackGroundColor(_options, serie, i),
                            borderColor: selectBorderColor(_options, serie, i),
                            borderWidth: _options.borderWidth,
                            hidden: isHiddenMap[selectLabel(_options, serie, i)] || false,
                        };
                    });

                    if (_options.fillGaps) {
                        fillGaps(chart, start, end, step, _options);
                    }

                    if (_options.dataSetHook) {
                        chart.data.datasets = _options.dataSetHook(chart.data.datasets);
                    }

                    setTimeAxesOptions(chart);

                    chart['datasource-prometheus']['loading'] = true;
                    chart.update();
                    chart['datasource-prometheus']['loading'] = false;

                } else {
                    chart.data.datasets = []; // no data
                }
            });

        return true;
    },
    beforeRender: (chart, options) => {
        const _options = opt.defaultOptionsValues(options);
        if (chart.data.datasets.length == 0) {
            var ctx = chart.chart.ctx;
            var width = chart.chart.width;
            var height = chart.chart.height;
            chart.clear();

            ctx.save();
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            if (_options.noData){
                ctx.font = _options.noData.font;
                ctx.fillText(_options.noData.message, width / 2, height / 2);
            } else {
                ctx.font = "16px normal 'Helvetica Nueue'";
                ctx.fillText('No data to display', width / 2, height / 2);
            }
            ctx.restore();
            return false;
        }
        return true
    },

    destroy: (chart, options) => {
        // auto update
        if (!!chart['datasource-prometheus']['updateInterval'])
            clearInterval(chart['datasource-prometheus']['updateInterval']);
    },

    constructors: {},
    extensions: {},

    register: (type, constructor, extensions) => {},

    getType: (url) => {},

    getConstructor: (type) => {}
};
