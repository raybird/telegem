
const engine = require('./cubshuang-engine.js');

const wifeData = {
    year: 1981,
    month: 8,
    day: 7,
    hour: '寅',
    gender: 'female'
};

const result = engine.calculateZiWeiChartComplete(wifeData);
console.log(JSON.stringify(result, null, 2));
