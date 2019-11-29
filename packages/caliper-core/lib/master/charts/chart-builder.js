/*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
* http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/


'use strict';

const Util = require('../../common/utils/caliper-utils');
const Logger = Util.getLogger('chart-builder');
const ConfigUtil = require('../../common/config/config-util');

const ColorScheme = require('color-scheme');

/**
 * ChartBuilder class for generating chart information to include in a test report
 */
class ChartBuilder {

    /**
     * Return chart statistics for the passed resourceStats
     * @param {string} callingMonitor the calling class name of the monitor, required to create a UUID
     * @param {Object} chartTypes the chart information for a monitor
     * @param {string} testLabel the current test label, required to create a UUID
     * @param {Map<string, string>[]} resourceStatsArray the resource stats to work with
     * @returns {Object[]} an array of chart stats object
     */
    static retrieveChartStats(callingMonitor, chartTypes, testLabel, resourceStatsArray) {
        const chartArray = [];
        // Produce each chart type requested
        for (const chartType of Object.keys(chartTypes)) {
            const metrics = chartTypes[chartType].metrics;
            const includeMetrics = ChartBuilder.retrieveIncludedMetrics(callingMonitor, chartType, metrics, resourceStatsArray[0]);
            switch (chartType) {
            case 'bar': {
                const barCharts = ChartBuilder.barChart(callingMonitor, testLabel, includeMetrics, resourceStatsArray);
                chartArray.push(...barCharts);
                break;
            }
            case 'polar': {
                const polarCharts = ChartBuilder.polarChart(callingMonitor, testLabel, includeMetrics, resourceStatsArray);
                chartArray.push(...polarCharts);
                break;
            }
            default:
                Logger.error(`Unknown chart type named "${chartType}" requested`);
            }
        }

        return chartArray;
    }

    /**
     * Determine the metric names to include
     * @param {string} callingMonitor calling className
     * @param {string} chartType chart type
     * @param {string[]} includeMetrics items to include ['all'] or ['item0', 'item1', ...]
     * @param {Map<string, string>} resourceStats a resource stat
     * @returns {string[]} a string array of metric names
     */
    static retrieveIncludedMetrics(callingMonitor, chartType, includeMetrics, resourceStats) {
        // includeMetrics must exist!
        if (!includeMetrics) {
            Logger.error(`Required "metrics" not provided for ${chartType} chart generation for monitor ${callingMonitor}`);
            return [];
        }

        // Cannot have 'all' with other items
        if (includeMetrics.indexOf('all') !== -1 && includeMetrics.length > 1) {
            Logger.error(`Cannot list "all" option with other metrics for ${chartType} chart generation for monitor ${callingMonitor}`);
            return [];
        }

        const metrics = [];
        for (const metric of resourceStats.keys()) {
            // Do not include 'Name'
            if ((metric.localeCompare('Name') === 0) || (metric.localeCompare('Type') === 0)) {
                continue;
            }

            // filter on all
            if (includeMetrics[0].toLowerCase().localeCompare('all') === 0) {
                Logger.debug(`Detected "all" option for ${chartType} chart generation for monitor ${callingMonitor}: including metric ${metric}`);
                metrics.push(metric);
                continue;
            }

            // filter on include
            for (const include of includeMetrics) {
                // beware of appended units to metric
                if (metric.includes(include)) {
                    Logger.debug(`Detected metric match on ${include} for ${chartType} chart generation for monitor ${callingMonitor}: including metric ${metric}`);
                    metrics.push(metric);
                    continue;
                }
            }
        }
        return metrics;
    }

    /**
     * Extract red component from hex value
     * @param {hex} h the hex code
     * @returns {number} the R component (0 -> 256)
     */
    static hexToR(h) {
        return parseInt((ChartBuilder.cutHex(h)).substring(0,2),16);
    }

    /**
     * Extract green component from hex value
     * @param {hex} h the hex code
     * @returns {number} the G component (0 -> 256)
     */
    static hexToG(h) {
        return parseInt((ChartBuilder.cutHex(h)).substring(2,4),16);
    }

    /**
     * Extract blue component from hex value
     * @param {hex} h the hex code
     * @returns {number} the B component (0 -> 256)
     */
    static hexToB(h) {
        return parseInt((ChartBuilder.cutHex(h)).substring(4,6),16);
    }

    /**
     * Extract red component from hex value
     * @param {hex} h the hex code
     * @returns {hex} the hex code without the leading #
     */
    static cutHex(h) {
        return (h.charAt(0)==='#') ? h.substring(1,7) : h;
    }

    /**
     * Use for building a bar or polar chart
     *  {
            'chart-id': 'UUID for chart',
            'chart-data': JSON.stringify({
                labels: [obj0, obj1, obj2, ...]
                type: 'bar' | 'polar',
                title: metric name,
                legend: false,
                datasets: [
                    {
                        backgroundColor,
                        data: [obj0_data, obj1_data, obj2_data, ...],
                    }
                ]
            })
        }
     *
     * @param {string} callingMonitor the calling class name used to create a UUID
     * @param {string} testLabel the current test label, required for creating a UUID
     * @param {string[]} includeMetrics the metrics to include in the chart
     * @param {Map<string, string>[]} resourceStatsArray all resource stats
     * @param {string} chartType the chart type (bar or polar)
     * @param {boolean} legend boolean flag to include legend or not
     * @returns {Object[]} an array of charting objects
     */
    static _basicChart(callingMonitor, testLabel, includeMetrics, resourceStatsArray, chartType, legend){
        // Loop over desired metrics
        const charts = [];
        let chartIndex = 0;
        for (const metricName of includeMetrics) {

            // Top Level Item
            const chart = {
                'chart-id': `${callingMonitor}_${testLabel}_${chartType}${chartIndex++}`,
            };

            // Chart Data - building on names
            const chartData = {
                type: chartType,
                title: metricName,
                legend: legend,
            };

            // Pull charting options from config to retrieve charting colours
            const hue = ConfigUtil.get(ConfigUtil.keys.Report.Charting.Hue, 21);
            const scheme = ConfigUtil.get(ConfigUtil.keys.Report.Charting.Scheme, 'triade');
            const transparency = ConfigUtil.get(ConfigUtil.keys.Report.Charting.Transparency, 0.6);
            const labels = [];
            const data = [];
            const backgroundColor = [];
            const colourScheme = new ColorScheme;
            const colours = colourScheme.from_hue(hue).scheme(scheme).colors();
            let i=0;
            for (const stat of resourceStatsArray) {
                // condition the retrieved value (numeric or zero)
                const value = stat.get(metricName);
                data.push(isNaN(value) ? 0 : value);
                labels.push(stat.get('Name'));
                // use rgba values so that we can include a transparency
                backgroundColor.push(`rgb(${ChartBuilder.hexToR(colours[i])},${ChartBuilder.hexToG(colours[i])},${ChartBuilder.hexToB(colours[i])},${transparency})`);
                i++;
                // We might have more data points than available colours, so reset the index if required
                if (i>=colours.length) {
                    i = 0;
                }
            }

            chartData.labels = labels;
            chartData.datasets = [{backgroundColor, data}];
            chart['chart-data'] = JSON.stringify(chartData);
            charts.push(chart);
        }
        return charts;
    }

    /**
     * Output an object that may be used by the template engine to render a bar chart within charting.js
     *
     * Bar charts assume the output of a single chart per metric, for all known names
     *
     * @param {string} callingMonitor the calling class, required for creating a UUID
     * @param {string} testLabel the current test label, required for creating a UUID
     * @param {string[]} includeMetrics metrics to be included in the output chart
     * @param {Map<string, string>[]} resourceStatsArray resource statistics to inspect and extract information from
     * @returns {Object[]} an array of charting objects
     */
    static barChart(callingMonitor, testLabel, includeMetrics, resourceStatsArray) {
        return ChartBuilder._basicChart(callingMonitor, testLabel, includeMetrics, resourceStatsArray, 'horizontalBar', false);
    }

    /**
     * Polar charts assume the output of a single chart per metric, for all known names
     *
     * @param {string} callingMonitor the calling class, required for creating a UUID
     * @param {string} testLabel the current test label, required for creating a UUID
     * @param {string[]} includeMetrics metrics to be included in the output chart
     * @param {Map<string, string>[]} resourceStatsArray resource statistics to inspect and extract information from
     * @returns {Object[]} an array of charting objects
     */
    static polarChart(callingMonitor, testLabel, includeMetrics, resourceStatsArray) {
        return ChartBuilder._basicChart(callingMonitor, testLabel, includeMetrics, resourceStatsArray, 'polarArea', true);
    }

}

module.exports = ChartBuilder;
