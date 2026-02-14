#!/usr/bin/env node
// =============================================================================
// 紫微斗數排盤 CLI (generate_chart.js)
// 用法: node generate_chart.js --year 1980 --month 12 --day 28 --hour 午 --gender male
// =============================================================================

const { calculateZiWeiChartComplete, EarthlyBranches } = require('./cubshuang-engine.js');

function parseArgs() {
    const args = process.argv.slice(2);
    const params = {};

    for (let i = 0; i < args.length; i += 2) {
        const key = args[i].replace('--', '');
        const value = args[i + 1];
        params[key] = value;
    }

    return params;
}

function hourToEarthlyBranch(hour, minute = 0) {
    // 如果已經是地支，直接返回
    if (EarthlyBranches.includes(hour)) {
        return hour;
    }

    // 如果是數字，轉換為時辰
    const h = parseInt(hour);
    const m = parseInt(minute) || 0;
    const totalMinutes = h * 60 + m;

    // 時辰對照表 (使用傳統時辰劃分)
    // 子時: 23:00-01:00, 丑時: 01:00-03:00, ...
    const hourBranches = [
        { start: 23 * 60, end: 24 * 60, branch: '子' },
        { start: 0, end: 1 * 60, branch: '子' },
        { start: 1 * 60, end: 3 * 60, branch: '丑' },
        { start: 3 * 60, end: 5 * 60, branch: '寅' },
        { start: 5 * 60, end: 7 * 60, branch: '卯' },
        { start: 7 * 60, end: 9 * 60, branch: '辰' },
        { start: 9 * 60, end: 11 * 60, branch: '巳' },
        { start: 11 * 60, end: 13 * 60, branch: '午' },
        { start: 13 * 60, end: 15 * 60, branch: '未' },
        { start: 15 * 60, end: 17 * 60, branch: '申' },
        { start: 17 * 60, end: 19 * 60, branch: '酉' },
        { start: 19 * 60, end: 21 * 60, branch: '戌' },
        { start: 21 * 60, end: 23 * 60, branch: '亥' }
    ];

    for (const hb of hourBranches) {
        if (totalMinutes >= hb.start && totalMinutes < hb.end) {
            return hb.branch;
        }
    }

    return '午'; // 預設
}

function main() {
    const params = parseArgs();

    // 驗證必要參數
    if (!params.year || !params.month || !params.day) {
        console.error('用法: node generate_chart.js --year YYYY --month MM --day DD --hour HH [--minute MM] [--gender male|female] [--location 地點]');
        console.error('範例: node generate_chart.js --year 1980 --month 12 --day 28 --hour 11 --minute 45 --gender male --location 台南');
        process.exit(1);
    }

    // 轉換時辰
    const hourBranch = hourToEarthlyBranch(params.hour, params.minute);

    // 構建輸入
    const birthData = {
        year: parseInt(params.year),
        month: parseInt(params.month),
        day: parseInt(params.day),
        hour: hourBranch,
        gender: params.gender || 'male',
        location: params.location || ''
    };

    // 執行計算
    const result = calculateZiWeiChartComplete(birthData);

    // 輸出 JSON
    console.log(JSON.stringify(result, null, 2));
}

main();
