#!/usr/bin/env node
// =============================================================================
// 紫微斗數排盤計算引擎 (cubshuang-engine.js)
// 完全對準 cubshuang/ZiWeiDouShu v5 demo 頁面實現
// 版本: 2.8.0
// 來源: https://github.com/cubshuang/ZiWeiDouShu
// Demo 頁面: https://cubshuang.github.io/ZiWeiDouShu/
// 授權: MIT License
// =============================================================================

// 基礎數據定義
var YinYang = ["陽", "陰"];
var HeavenlyStems = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"];
var EarthlyBranches = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"];
var Palace = ["【命宮】", "【父母宮】", "【福德宮】", "【田宅宮】", "【官祿宮】", "【交友宮】", "【遷移宮】", "【疾厄宮】", "【財帛宮】", "【子女宮】", "【夫妻宮】", "【兄弟宮】", "【身】"];
var FiveElements = ["水二局", "火六局", "土五局", "木三局", "金四局"];

// 星曜名稱定義
var StarM_A14 = ["紫微", "天機", "太陽", "武曲", "天同", "廉貞", "天府", "太陰", "貪狼", "巨門", "天相", "天梁", "七殺", "破軍"];
var StarM_A07 = ["文昌", "文曲", "左輔", "右弼", "天魁", "天鉞", "祿存"];
var StarM_S04 = ["化祿", "化權", "化科", "化忌"];
var StarM_B06 = ["擎羊", "陀羅", "火星", "鈴星", "天空", "地劫"];
var StarO_S05 = ["天馬", "龍池", "鳳閣", "紅鸞", "天喜"];

// 五行局表
var FiveEleTable = [
    [1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 0, 0, 1, 1, 2, 2, 3, 3, 4], // 水二局
    [9, 6, 11, 4, 1, 2, 10, 7, 0, 5, 2, 3, 11, 8, 1, 6, 3, 4, 0, 9, 2, 7, 4, 5, 1, 10, 3, 8, 5, 6], // 火六局
    [6, 11, 4, 1, 2, 7, 0, 5, 2, 3, 8, 1, 6, 3, 4, 9, 2, 7, 4, 5, 10, 3, 8, 5, 6, 11, 4, 9, 6, 7], // 土五局
    [4, 1, 2, 5, 2, 3, 6, 3, 4, 7, 4, 5, 8, 5, 6, 9, 6, 7, 10, 7, 8, 11, 8, 9, 0, 9, 10, 1, 10, 11], // 木三局
    [11, 4, 1, 2, 0, 5, 2, 3, 1, 6, 3, 4, 2, 7, 4, 5, 3, 8, 5, 6, 4, 9, 6, 7, 5, 10, 7, 8, 6, 11]  // 金四局
];

var FiveEleArr = [[0, 1, 3, 2, 4, 1], [1, 2, 4, 3, 0, 2], [2, 3, 0, 4, 1, 3], [3, 4, 1, 0, 2, 4], [4, 0, 2, 1, 3, 0]];

// 主星安星表
var Star_A14 = [
    [[0], [], [13], [], [5, 6], [7], [8], [4, 9], [3, 10], [2, 11], [12], [1]],
    [[1], [0, 13], [], [6], [7], [5, 8], [9], [10], [4, 11], [3, 12], [2], []],
    [[13], [1], [0, 6], [7], [8], [9], [5, 10], [11], [12], [10], [3], [2]],
    [[2], [6], [1, 7], [0, 8], [9], [10], [11], [5, 12], [], [], [4], [3, 13]],
    [[3, 6], [2, 7], [8], [1, 9], [0, 10], [11], [12], [], [5], [], [13], [4]],
    [[4, 7], [3, 8], [2, 9], [10], [1, 10], [0, 12], [], [], [], [5, 13], [], [6]],
    [[8], [4, 9], [3, 10], [2, 11], [12], [1], [0], [], [13], [], [5, 6], [7]],
    [[9], [10], [4, 11], [3, 12], [2], [], [1], [0, 13], [], [6], [7], [5, 8]],
    [[5, 10], [11], [12], [10], [3], [2], [13], [1], [0, 6], [7], [8], [9]],
    [[11], [5, 12], [], [], [4], [3, 13], [2], [6], [1, 7], [0, 8], [9], [10]],
    [[12], [], [5], [], [13], [4], [3, 6], [2, 7], [8], [1, 9], [0, 10], [11]],
    [[], [], [], [5, 13], [], [6], [4, 7], [3, 8], [2, 9], [10], [1, 10], [0, 12]]
];

// 紫微星系安星表
var Star_Z06 = [
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
    [11, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    [9, 10, 11, 0, 1, 2, 3, 4, 5, 6, 7, 8],
    [8, 9, 10, 11, 0, 1, 2, 3, 4, 5, 6, 7],
    [7, 8, 9, 10, 11, 0, 1, 2, 3, 4, 5, 6],
    [4, 5, 6, 7, 8, 9, 10, 11, 0, 1, 2, 3],
    [4, 3, 2, 1, 0, 11, 10, 9, 8, 7, 6, 5]
];

// 天府星系安星表
var Star_T08 = [
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 0],
    [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 0, 1],
    [3, 4, 5, 6, 7, 8, 9, 10, 11, 0, 1, 2],
    [4, 5, 6, 7, 8, 9, 10, 11, 0, 1, 2, 3],
    [5, 6, 7, 8, 9, 10, 11, 0, 1, 2, 3, 4],
    [6, 7, 8, 9, 10, 11, 0, 1, 2, 3, 4, 5],
    [10, 11, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
];

// 輔星安星表
var Star_G07 = [
    [10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0, 11], // 文昌
    [4, 5, 6, 7, 8, 9, 10, 11, 0, 1, 2, 3], // 文曲
    [4, 5, 6, 7, 8, 9, 10, 11, 0, 1, 2, 3], // 左輔
    [10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0, 11], // 右弼
    [1, 0, 11, 11, 1, 0, 1, 6, 3, 3],     // 天魁
    [7, 8, 9, 9, 7, 8, 7, 2, 5, 5],       // 天鉞
    [2, 3, 5, 6, 5, 6, 8, 9, 11, 0]       // 祿存
];

// 四化星表
var Star_S04 = [
    [StarM_A14[5], StarM_A14[1], StarM_A14[4], StarM_A14[7], StarM_A14[8], StarM_A14[3], StarM_A14[2], StarM_A14[9], StarM_A14[11], StarM_A14[13]], // 化祿
    [StarM_A14[13], StarM_A14[11], StarM_A14[1], StarM_A14[4], StarM_A14[7], StarM_A14[8], StarM_A14[3], StarM_A14[2], StarM_A14[0], StarM_A14[9]], // 化權
    [StarM_A14[3], StarM_A14[0], StarM_A07[0], StarM_A14[1], StarM_A07[3], StarM_A14[11], StarM_A14[7], StarM_A07[1], StarM_A07[2], StarM_A14[7]], // 化科
    [StarM_A14[2], StarM_A14[7], StarM_A14[5], StarM_A14[9], StarM_A14[1], StarM_A07[1], StarM_A14[4], StarM_A07[0], StarM_A14[3], StarM_A14[8]]  // 化忌
];

// 煞星安星表
var Star_B06 = [
    [3, 4, 6, 7, 6, 7, 9, 10, 0, 1], // 擎羊
    [1, 2, 4, 5, 4, 5, 7, 8, 10, 11], // 陀羅
    [[2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 0, 1], [3, 4, 5, 6, 7, 8, 9, 10, 11, 0, 1, 2], [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 0], [9, 10, 11, 0, 1, 2, 3, 4, 5, 6, 7, 8]], // 火星
    [[10, 11, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9], [10, 11, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9], [3, 4, 5, 6, 7, 8, 9, 10, 11, 0, 1, 2], [10, 11, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9]], // 鈴星
    [11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0], // 天空
    [11, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]  // 地劫
];

// 雜曜安星表
var Star_OS5 = [
    [2, 11, 8, 5, 2, 11, 8, 5, 2, 11, 8, 5], // 天馬
    [4, 5, 6, 7, 8, 9, 10, 11, 0, 1, 2, 3],  // 龍池
    [10, 11, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9],  // 鳳閣
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 0],  // 紅鸞
    [7, 8, 9, 10, 11, 0, 1, 2, 3, 4, 5, 6]   // 天喜
];

// =============================================================================
// 農曆轉換函數庫 (lunar.js)
// 來源: https://github.com/cubshuang/ZiWeiDouShu/blob/master/js/lunar.js
// =============================================================================

var BYEAR = 1201;
var Nyear = 150;
var Nmonth = 13;

function make_array() {
    var tmparg = make_array.arguments;
    for (var i = 0; i < tmparg.length; i++) {
        this[i] = tmparg[i];
    }
    this.length = tmparg.length;
}

function make_n_array(num) {
    for (var i = 0; i < num; i++) {
        this[i] = i;
    }
    this.length = num;
}

function MyDate(y, m, d, h, w, l) {
    this.y = y;
    this.m = m;
    this.d = d;
    this.h = h;
    this.w = w;
    this.l = l;
}

var yearInfo = new make_array(
    0x04bd8,        /* 1900 */
    0x04ae0, 0x0a570, 0x054d5, 0x0d260, 0x0d950,        /* 1905 */
    0x16554, 0x056a0, 0x09ad0, 0x055d2, 0x04ae0,        /* 1910 */
    0x0a5b6, 0x0a4d0, 0x0d250, 0x1d255, 0x0b540,        /* 1915 */
    0x0d6a0, 0x0ada2, 0x095b0, 0x14977, 0x04970,        /* 1920 */
    0x0a4b0, 0x0b4b5, 0x06a50, 0x06d40, 0x1ab54,        /* 1925 */
    0x02b60, 0x09570, 0x052f2, 0x04970, 0x06566,        /* 1930 */
    0x0d4a0, 0x0ea50, 0x06e95, 0x05ad0, 0x02b60,        /* 1935 */
    0x186e3, 0x092e0, 0x1c8d7, 0x0c950, 0x0d4a0,        /* 1940 */
    0x1d8a6, 0x0b550, 0x056a0, 0x1a5b4, 0x025d0,        /* 1945 */
    0x092d0, 0x0d2b2, 0x0a950, 0x0b557, 0x06ca0,        /* 1950 */
    0x0b550, 0x15355, 0x04da0, 0x0a5d0, 0x14573,        /* 1955 */
    0x052d0, 0x0a9a8, 0x0e950, 0x06aa0, 0x0aea6,        /* 1960 */
    0x0ab50, 0x04b60, 0x0aae4, 0x0a570, 0x05260,        /* 1965 */
    0x0f263, 0x0d950, 0x05b57, 0x056a0, 0x096d0,        /* 1970 */
    0x04dd5, 0x04ad0, 0x0a4d0, 0x0d4d4, 0x0d250,        /* 1975 */
    0x0d558, 0x0b540, 0x0b5a0, 0x195a6, 0x095b0,        /* 1980 */
    0x049b0, 0x0a974, 0x0a4b0, 0x0b27a, 0x06a50,        /* 1985 */
    0x06d40, 0x0af46, 0x0ab60, 0x09570, 0x04af5,        /* 1990 */
    0x04970, 0x064b0, 0x074a3, 0x0ea50, 0x06b58,        /* 1995 */
    0x055c0, 0x0ab60, 0x096d5, 0x092e0, 0x0c960,        /* 2000 */
    0x0d954, 0x0d4a0, 0x0da50, 0x07552, 0x056a0,        /* 2005 */
    0x0abb7, 0x025d0, 0x092d0, 0x0cab5, 0x0a950,        /* 2010 */
    0x0b4a0, 0x0baa4, 0x0ad50, 0x055d9, 0x04ba0,        /* 2015 */
    0x0a5b0, 0x15176, 0x052b0, 0x0a930, 0x07954,        /* 2020 */
    0x06aa0, 0x0ad50, 0x05b52, 0x04b60, 0x0a6e6,        /* 2025 */
    0x0a4e0, 0x0d260, 0x0ea65, 0x0d530, 0x05aa0,        /* 2030 */
    0x076a3, 0x096d0, 0x04bd7, 0x04ad0, 0x0a4d0,        /* 2035 */
    0x1d0b6, 0x0d250, 0x0d520, 0x0dd45, 0x0b5a0,        /* 2040 */
    0x056d0, 0x055b2, 0x049b0, 0x0a577, 0x0a4b0,        /* 2045 */
    0x0aa50, 0x1b255, 0x06d20, 0x0ada0                  /* 2049 */
);

var fest = new make_array(
    4, 6, 5, 6, 6, 7, 8, 8, 9, 8, 7, 6,   /* 1900 */
    4, 6, 5, 6, 6, 8, 8, 8, 9, 8, 8, 6,   /* 1901 */
    5, 6, 6, 6, 7, 8, 8, 8, 9, 8, 8, 6,   /* 1902 */
    5, 7, 6, 7, 7, 8, 9, 9, 9, 8, 8, 7,   /* 1903 */
    5, 6, 5, 6, 6, 7, 8, 8, 9, 8, 7, 6,   /* 1904 */
    4, 6, 5, 6, 6, 8, 8, 8, 9, 8, 8, 6,   /* 1905 */
    5, 6, 6, 6, 6, 8, 8, 8, 9, 8, 8, 6,   /* 1906 */
    5, 7, 6, 7, 7, 8, 9, 9, 9, 8, 8, 7,   /* 1907 */
    5, 6, 5, 6, 6, 7, 8, 8, 9, 8, 7, 6,   /* 1908 */
    4, 6, 5, 6, 6, 8, 8, 8, 9, 8, 8, 6,   /* 1909 */
    5, 6, 6, 6, 6, 8, 8, 8, 9, 8, 8, 6,   /* 1910 */
    5, 7, 6, 7, 7, 8, 9, 9, 9, 8, 8, 7,   /* 1911 */
    5, 6, 5, 6, 6, 7, 8, 8, 9, 8, 7, 6,   /* 1912 */
    4, 6, 5, 6, 6, 8, 8, 8, 9, 8, 8, 6,   /* 1913 */
    4, 6, 5, 6, 6, 8, 8, 8, 9, 8, 8, 6,   /* 1914 */
    5, 6, 6, 6, 7, 8, 8, 9, 9, 8, 8, 6,   /* 1915 */
    5, 6, 5, 6, 6, 7, 8, 8, 8, 8, 7, 6,   /* 1916 */
    4, 6, 5, 6, 6, 8, 8, 8, 9, 8, 7, 6,   /* 1917 */
    4, 6, 5, 6, 6, 8, 8, 8, 9, 8, 8, 6,   /* 1918 */
    5, 6, 6, 6, 7, 8, 8, 9, 9, 8, 8, 6,   /* 1919 */
    5, 6, 5, 6, 6, 7, 8, 8, 8, 8, 7, 6,   /* 1920 */
    4, 6, 5, 6, 6, 8, 8, 8, 9, 9, 7, 6,   /* 1921 */
    4, 6, 5, 6, 6, 8, 8, 8, 9, 8, 8, 6,   /* 1922 */
    5, 6, 6, 6, 7, 8, 8, 9, 9, 8, 8, 6,   /* 1923 */
    5, 6, 5, 6, 6, 7, 8, 8, 8, 8, 7, 6,   /* 1924 */
    4, 6, 5, 6, 6, 8, 8, 8, 9, 8, 7, 6,   /* 1925 */
    4, 6, 5, 6, 6, 8, 8, 8, 9, 8, 8, 6,   /* 1926 */
    5, 6, 6, 6, 7, 8, 8, 8, 9, 8, 8, 6,   /* 1927 */
    5, 6, 5, 6, 6, 7, 8, 8, 8, 7, 7, 6,   /* 1928 */
    4, 6, 5, 6, 6, 7, 8, 8, 9, 8, 7, 6,   /* 1929 */
    4, 6, 5, 6, 6, 8, 8, 8, 9, 8, 8, 6,   /* 1930 */
    5, 6, 6, 6, 7, 8, 8, 8, 9, 8, 8, 6,   /* 1931 */
    5, 6, 5, 6, 6, 7, 8, 8, 8, 7, 7, 6,   /* 1932 */
    4, 6, 5, 6, 6, 7, 8, 8, 9, 8, 7, 6,   /* 1933 */
    4, 6, 5, 6, 6, 8, 8, 8, 9, 8, 8, 6,   /* 1934 */
    5, 6, 6, 6, 6, 8, 8, 8, 9, 8, 8, 6,   /* 1935 */
    5, 6, 5, 6, 6, 7, 8, 8, 8, 7, 7, 6,   /* 1936 */
    4, 6, 5, 6, 6, 7, 8, 8, 9, 8, 7, 6,   /* 1937 */
    4, 6, 5, 6, 6, 8, 8, 8, 9, 8, 8, 6,   /* 1938 */
    5, 6, 6, 6, 6, 8, 8, 8, 9, 8, 8, 6,   /* 1939 */
    5, 6, 5, 6, 6, 7, 8, 8, 8, 7, 7, 6,   /* 1940 */
    4, 6, 5, 6, 6, 7, 8, 8, 9, 8, 7, 6,   /* 1941 */
    4, 6, 5, 6, 6, 8, 8, 8, 9, 8, 8, 6,   /* 1942 */
    5, 6, 6, 6, 6, 8, 8, 8, 9, 8, 8, 6,   /* 1943 */
    5, 6, 5, 5, 6, 7, 8, 8, 8, 7, 7, 6,   /* 1944 */
    4, 6, 5, 6, 6, 7, 8, 8, 8, 8, 7, 6,   /* 1945 */
    4, 6, 5, 6, 6, 8, 8, 8, 9, 8, 8, 6,   /* 1946 */
    4, 6, 5, 6, 6, 8, 8, 8, 9, 8, 8, 6,   /* 1947 */
    5, 5, 5, 5, 6, 7, 7, 8, 8, 7, 7, 5,   /* 1948 */
    4, 6, 5, 6, 6, 7, 8, 8, 8, 8, 7, 6,   /* 1949 */
    4, 6, 5, 6, 6, 8, 8, 8, 9, 8, 8, 6,   /* 1950 */
    4, 6, 5, 6, 6, 8, 8, 8, 9, 8, 8, 6,   /* 1951 */
    5, 5, 5, 5, 6, 7, 7, 8, 8, 7, 7, 5,   /* 1952 */
    4, 6, 5, 6, 6, 7, 8, 8, 8, 8, 7, 6,   /* 1953 */
    4, 6, 5, 6, 6, 8, 8, 8, 9, 8, 7, 6,   /* 1954 */
    4, 6, 5, 6, 6, 8, 8, 8, 9, 8, 8, 6,   /* 1955 */
    5, 5, 5, 5, 6, 7, 7, 8, 8, 7, 7, 5,   /* 1956 */
    4, 6, 5, 6, 6, 7, 8, 8, 8, 8, 7, 6,   /* 1957 */
    4, 6, 5, 6, 6, 7, 8, 8, 9, 8, 7, 6,   /* 1958 */
    4, 6, 5, 6, 6, 8, 8, 8, 9, 8, 8, 6,   /* 1959 */
    5, 5, 5, 5, 6, 7, 7, 7, 8, 7, 7, 5,   /* 1960 */
    4, 6, 5, 6, 6, 7, 8, 8, 8, 7, 7, 6,   /* 1961 */
    4, 6, 5, 6, 6, 7, 8, 8, 9, 8, 7, 6,   /* 1962 */
    4, 6, 5, 6, 6, 8, 8, 8, 9, 8, 8, 6,   /* 1963 */
    5, 5, 5, 5, 6, 7, 7, 7, 8, 7, 7, 5,   /* 1964 */
    4, 6, 5, 6, 6, 7, 8, 8, 8, 7, 7, 6,   /* 1965 */
    4, 6, 5, 6, 6, 7, 8, 8, 9, 8, 7, 6,   /* 1966 */
    4, 6, 5, 6, 6, 8, 8, 8, 9, 8, 8, 6,   /* 1967 */
    5, 5, 5, 5, 5, 7, 7, 7, 8, 7, 7, 5,   /* 1968 */
    4, 6, 5, 6, 6, 7, 8, 8, 8, 7, 7, 6,   /* 1969 */
    4, 6, 5, 6, 6, 7, 8, 8, 9, 8, 7, 6,   /* 1970 */
    4, 6, 5, 6, 6, 8, 8, 8, 9, 8, 8, 6,   /* 1971 */
    5, 5, 5, 5, 5, 7, 7, 7, 8, 7, 7, 5,   /* 1972 */
    4, 6, 5, 5, 6, 7, 8, 8, 8, 7, 7, 6,   /* 1973 */
    4, 6, 5, 6, 6, 7, 8, 8, 9, 8, 7, 6,   /* 1974 */
    4, 6, 5, 6, 6, 8, 8, 8, 9, 8, 8, 6,   /* 1975 */
    5, 5, 4, 5, 5, 7, 7, 7, 8, 7, 7, 5,   /* 1976 */
    4, 6, 5, 5, 6, 7, 7, 8, 8, 7, 7, 6,   /* 1977 */
    4, 6, 5, 6, 6, 7, 8, 8, 8, 8, 7, 6,   /* 1978 */
    4, 6, 5, 6, 6, 8, 8, 8, 9, 8, 8, 6,   /* 1979 */
    5, 5, 4, 5, 5, 7, 7, 7, 8, 7, 7, 5,   /* 1980 */
    4, 6, 5, 5, 6, 7, 7, 8, 8, 7, 7, 6,   /* 1981 */
    4, 6, 5, 6, 6, 7, 8, 8, 8, 8, 7, 6,   /* 1982 */
    4, 6, 5, 6, 6, 8, 8, 8, 9, 8, 8, 6,   /* 1983 */
    4, 5, 4, 5, 5, 7, 7, 7, 8, 7, 7, 5,   /* 1984 */
    5, 5, 5, 5, 5, 8, 7, 7, 8, 7, 7, 5,   /* 1985 */
    4, 6, 5, 6, 6, 7, 8, 8, 8, 8, 7, 6,   /* 1986 */
    4, 6, 5, 6, 6, 7, 8, 8, 9, 8, 7, 6,   /* 1987 */
    4, 5, 4, 5, 5, 7, 7, 7, 8, 7, 7, 5,   /* 1988 */
    5, 5, 5, 5, 5, 7, 7, 7, 8, 7, 7, 5,   /* 1989 */
    4, 6, 5, 6, 6, 7, 8, 8, 8, 8, 7, 6,   /* 1990 */
    4, 6, 5, 6, 6, 7, 8, 8, 9, 8, 7, 6,   /* 1991 */
    4, 5, 4, 5, 5, 7, 7, 7, 8, 7, 7, 5,   /* 1992 */
    5, 5, 5, 5, 5, 7, 7, 7, 8, 7, 7, 5,   /* 1993 */
    4, 6, 5, 6, 6, 7, 8, 8, 8, 7, 7, 6,   /* 1994 */
    4, 6, 5, 6, 6, 7, 8, 8, 9, 8, 7, 6,   /* 1995 */
    4, 5, 4, 5, 5, 7, 7, 7, 8, 7, 7, 5,   /* 1996 */
    5, 5, 4, 5, 5, 7, 7, 7, 8, 7, 7, 5,   /* 1997 */
    4, 6, 5, 6, 6, 7, 8, 8, 8, 7, 7, 6,   /* 1998 */
    4, 6, 5, 6, 6, 7, 8, 8, 9, 8, 7, 6,   /* 1999 */
    4, 5, 4, 5, 5, 7, 7, 7, 8, 7, 7, 5,   /* 2000 */
    4, 5, 5, 5, 5, 7, 7, 7, 8, 7, 7, 5,   /* 2001 */
    4, 6, 5, 6, 6, 7, 8, 8, 8, 7, 7, 6,   /* 2002 */
    4, 6, 5, 6, 6, 7, 8, 8, 9, 8, 7, 6,   /* 2003 */
    4, 5, 4, 5, 5, 7, 7, 7, 8, 7, 7, 5,   /* 2004 */
    4, 5, 5, 5, 5, 7, 7, 7, 8, 7, 7, 5,   /* 2005 */
    4, 6, 5, 5, 6, 7, 7, 8, 8, 7, 7, 6,   /* 2006 */
    4, 6, 5, 6, 6, 7, 8, 8, 9, 8, 7, 6,   /* 2007 */
    4, 5, 4, 5, 5, 7, 7, 7, 8, 7, 7, 5,   /* 2008 */
    4, 5, 4, 5, 5, 7, 7, 7, 8, 7, 7, 5,   /* 2009 */
    4, 6, 5, 5, 6, 7, 7, 8, 8, 7, 7, 6,   /* 2010 */
    4, 6, 5, 6, 6, 7, 8, 8, 8, 8, 7, 6,   /* 2011 */
    4, 5, 4, 5, 5, 7, 7, 7, 8, 7, 7, 5,   /* 2012 */
    4, 5, 4, 5, 5, 7, 7, 7, 8, 7, 7, 5,   /* 2013 */
    4, 6, 5, 5, 6, 7, 7, 8, 8, 7, 7, 6,   /* 2014 */
    4, 6, 5, 6, 6, 7, 8, 8, 8, 8, 7, 6,   /* 2015 */
    4, 5, 4, 5, 5, 7, 7, 7, 8, 7, 7, 5,   /* 2016 */
    3, 5, 4, 5, 5, 7, 7, 7, 8, 7, 7, 5,   /* 2017 */
    4, 5, 5, 5, 6, 7, 7, 8, 8, 7, 7, 5,   /* 2018 */
    4, 6, 5, 6, 6, 7, 8, 8, 8, 8, 7, 6,   /* 2019 */
    4, 5, 4, 5, 5, 6, 7, 7, 8, 7, 7, 5,   /* 2020 */
    3, 5, 4, 5, 5, 7, 7, 7, 8, 7, 7, 5,   /* 2021 */
    4, 5, 5, 5, 6, 7, 7, 7, 8, 7, 7, 5,   /* 2022 */
    4, 6, 5, 6, 6, 7, 8, 8, 8, 8, 7, 6,   /* 2023 */
    4, 5, 4, 5, 5, 6, 7, 7, 8, 7, 6, 5,   /* 2024 */
    3, 5, 4, 5, 5, 7, 7, 7, 8, 7, 7, 5,   /* 2025 */
    4, 5, 5, 5, 5, 7, 7, 7, 8, 7, 7, 5,   /* 2026 */
    4, 6, 5, 6, 6, 7, 8, 8, 8, 7, 7, 6,   /* 2027 */
    4, 5, 4, 5, 5, 6, 7, 7, 8, 7, 6, 5,   /* 2028 */
    3, 5, 4, 5, 5, 7, 7, 7, 8, 7, 7, 5,   /* 2029 */
    4, 5, 5, 5, 5, 7, 7, 7, 8, 7, 7, 5,   /* 2030 */
    4, 6, 5, 6, 6, 7, 8, 8, 8, 7, 7, 6,   /* 2031 */
    4, 5, 4, 5, 5, 6, 7, 7, 8, 7, 6, 5,   /* 2032 */
    3, 5, 4, 5, 5, 7, 7, 7, 8, 7, 7, 5,   /* 2033 */
    4, 5, 5, 5, 5, 7, 7, 7, 8, 7, 7, 5,   /* 2034 */
    4, 6, 5, 5, 6, 7, 7, 8, 8, 7, 7, 6,   /* 2035 */
    4, 5, 4, 5, 5, 6, 7, 7, 8, 7, 6, 5,   /* 2036 */
    3, 5, 4, 5, 5, 7, 7, 7, 8, 7, 7, 5,   /* 2037 */
    4, 5, 5, 5, 5, 7, 7, 7, 8, 7, 7, 5,   /* 2038 */
    4, 6, 5, 5, 6, 7, 7, 8, 8, 7, 7, 6,   /* 2039 */
    4, 5, 4, 5, 5, 6, 7, 7, 8, 7, 6, 5,   /* 2040 */
    3, 5, 4, 5, 5, 7, 7, 7, 8, 7, 7, 5,   /* 2041 */
    4, 5, 4, 5, 5, 7, 7, 7, 8, 7, 7, 5,   /* 2042 */
    4, 6, 5, 5, 6, 7, 7, 8, 8, 7, 7, 6,   /* 2043 */
    4, 5, 4, 5, 5, 6, 7, 7, 7, 7, 6, 5,   /* 2044 */
    3, 5, 4, 5, 5, 7, 7, 7, 8, 7, 7, 5,   /* 2045 */
    4, 5, 4, 5, 5, 7, 7, 7, 8, 7, 7, 5,   /* 2046 */
    4, 6, 5, 5, 6, 7, 7, 8, 8, 7, 7, 6,   /* 2047 */
    4, 5, 4, 5, 5, 6, 7, 7, 7, 7, 6, 5,   /* 2048 */
    3, 5, 4, 5, 5, 6, 7, 7, 8, 7, 7, 5    /* 2049 */
);

var ymonth = new make_n_array(Nyear);
var yday = new make_n_array(Nyear);
var mday = new make_n_array(Nmonth + 1);
var moon = new make_array(29, 30);
var GanGB = new make_array("甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸");
var ZhiGB = new make_array("子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥");
var daysInSolarMonth = new make_array(0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31);
var solarFirstDate = new MyDate(1900, 1, 31, 0, 3, 0);
var LunarFirstDate = new MyDate(1900, 1, 1, 0, 3, 0);
var GanFirstDate = new MyDate(6, 4, 0, 0, 3, 0);
var ZhiFirstDate = new MyDate(0, 2, 4, 0, 3, 0);

var solar_global = new MyDate(0, 0, 0, 0, 0, 0);
var lunar_global = new MyDate(0, 0, 0, 0, 0, 0);
var gan_global = new MyDate(0, 0, 0, 0, 0, 0);
var zhi_global = new MyDate(0, 0, 0, 0, 0, 0);

function LeapYear(y) {
    return (((y % 4) == 0) && ((y % 100) != 0) || ((y % 400) == 0));
}

function solar2Day1(d) {
    var offset, delta;
    var i;
    delta = d.y - BYEAR;
    if (delta < 0) {
        return -1;
    }
    offset = Math.floor(delta * 365) + Math.floor(delta / 4) - Math.floor(delta / 100) + Math.floor(delta / 400);
    for (i = 1; i < d.m; i++) {
        offset += daysInSolarMonth[i];
    }
    if ((d.m > 2) && (LeapYear(d.y))) offset++;
    offset += d.d - 1;
    if ((d.m == 2) && LeapYear(d.y)) {
        if (d.d > 29) {
            return -1;
        }
    }
    else if (d.d > daysInSolarMonth[d.m]) {
        return -1;
    }
    return offset;
}

function solar2Day(d) {
    return (solar2Day1(d) - solar2Day1(solarFirstDate));
}

function make_yday() {
    var year, i, leap;
    var code;
    for (year = 0; year < Nyear; year++) {
        code = yearInfo[year];
        leap = code & 0xf;
        yday[year] = 0;
        if (leap != 0) {
            i = (code >> 16) & 0x1;
            yday[year] += moon[i];
        }
        code >>= 4;
        for (i = 0; i < Nmonth - 1; i++) {
            yday[year] += moon[code & 0x1];
            code >>= 1;
        }
        ymonth[year] = 12;
        if (leap != 0) ymonth[year]++;
    }
    return Nyear;
}

function make_mday(year) {
    var i, leapMonth, code;
    code = yearInfo[year];
    leapMonth = code & 0xf;
    code >>= 4;
    if (leapMonth == 0) {
        mday[Nmonth] = 0;
        for (i = Nmonth - 1; i >= 1; i--) {
            mday[i] = moon[code & 0x1];
            code >>= 1;
        }
    }
    else {
        i = (yearInfo[year] >> 16) & 0x1;
        mday[leapMonth + 1] = moon[i];
        for (i = Nmonth; i >= 1; i--) {
            if (i == leapMonth + 1) i--;
            mday[i] = moon[code & 0x1];
            code >>= 1;
        }
    }
    return leapMonth;
}

function day2Lunar(offset, d) {
    var i, m, nYear, leapMonth;
    nYear = make_yday();
    for (i = 0; i < nYear && offset > 0; i++)  offset -= yday[i];
    if (offset < 0) offset += yday[--i];
    if (i == Nyear) {
        return;
    }
    d.y = i + LunarFirstDate.y;
    leapMonth = make_mday(i);
    for (m = 1; m <= Nmonth && offset > 0; m++)  offset -= mday[m];
    if (offset < 0) offset += mday[--m];
    d.l = 0;
    if (leapMonth > 0) {
        d.l = (leapMonth == (m - 1));
        if (m > leapMonth) --m;
    }
    d.m = m;
    d.d = offset + 1;
}

function CalGZ(offset, d, g, z) {
    var year, month;
    year = d.y - LunarFirstDate.y;
    month = year * 12 + d.m - 1;
    g.y = (GanFirstDate.y + year) % 10;
    z.y = (ZhiFirstDate.y + year) % 12;
    g.m = (GanFirstDate.m + month) % 10;
    z.m = (ZhiFirstDate.m + month) % 12;
    g.d = (GanFirstDate.d + offset) % 10;
    z.d = (ZhiFirstDate.d + offset) % 12;
    z.h = Math.floor((d.h + 1) / 2) % 12;
    g.h = (g.d * 12 + z.h) % 10;
}

function CmpDate(month1, day1, month2, day2) {
    if (month1 != month2) return (month1 - month2);
    if (day1 != day2) return (day1 - day2);
    return (0);
}

function JieDate(ds, dl) {
    var m, flag;
    if (ds.m == 1) {
        flag = CmpDate(ds.m, ds.d, 1, fest[(ds.y - solarFirstDate.y - 1) * 12 + 11]);
        if (flag < 0) dl.m = 11;
        else if (flag > 0) dl.m = 12;
        dl.y = ds.y - 1;
        return (flag == 0);
    }
    for (m = 2; m <= 12; m++) {
        flag = CmpDate(ds.m, ds.d, m, fest[(ds.y - solarFirstDate.y) * 12 + m - 2]);
        if (flag == 0) m++;
        if (flag <= 0) break;
    }
    dl.m = (m - 2) % 12;
    dl.y = ds.y;
    if ((dl.m) == 0) {
        dl.y = ds.y - 1;
        dl.m = 12;
    }
    return (flag == 0);
}

function solar2Lunar() {
    var offset;
    offset = solar2Day(solar_global);
    solar_global.w = (offset + solarFirstDate.w) % 7;
    if (solar_global.h == 23) offset++;
    day2Lunar(offset, lunar_global);
    lunar_global.h = solar_global.h;
    CalGZ(offset, lunar_global, gan_global, zhi_global);
}

function Lunar(type, my_y, my_m, my_d) {
    if (type == 0) {
        solar_global.y = my_y;
        solar_global.m = my_m;
        solar_global.d = my_d;
        solar_global.h = 0;
        solar2Lunar();
    }
}

// =============================================================================
// 核心計算函數 - 完全對準 cubshuang/ZiWeiDouShu 原始實現
// =============================================================================

// 全域變數
var y, m, d, h, g;
var yS, mS, dS;
var y1Pos, y2Pos, hPos;
var l, lPos, b, bPos, f, fIndex, z, zPos;
var Place12;

function computeZiWei(y_Solar, m_Solar, d_Solar, h_Solar, g_Solar) {
    yS = y_Solar;
    mS = m_Solar;
    dS = d_Solar;

    Lunar(0, yS, mS, dS);

    y = HeavenlyStems[(yS - 4) % 10] + EarthlyBranches[(yS - 4) % 12];
    m = lunar_global.m;
    d = lunar_global.d;
    h = h_Solar;
    g = g_Solar;

    y1Pos = HeavenlyStems.indexOf(y.substring(0, 1));
    y2Pos = EarthlyBranches.indexOf(y.substring(1, 2));

    hPos = EarthlyBranches.indexOf(h);

    setZiwei(d);
    stepSetStar(y, m, d, h);

    return Place12;
}


function setZiwei(d) {
    l = EarthlyBranches[((12 - hPos) + 1 + m * 1.0) % 12];
    lPos = EarthlyBranches.indexOf(l);

    b = EarthlyBranches[(12 - ((22 - hPos) + 1 - m * 1.0) % 12) % 12];
    bPos = EarthlyBranches.indexOf(b);

    f = FiveElements[FiveEleArr[y1Pos % 5][((lPos - (lPos % 2 == 0 ? 0 : 1)) / 2) % 6]];
    fIndex = FiveElements.indexOf(f);

    z = EarthlyBranches[FiveEleTable[fIndex][d - 1]];
    zPos = EarthlyBranches.indexOf(z);
}

function stepSetStar(y, m, d, h) {
    var s14 = Star_A14[zPos];
    var sZ06 = getStarArr(Star_Z06, 7, zPos);
    var sT08 = getStarArr(Star_T08, 8, sZ06[6]);

    var sG07 = getStarArrByPosArr(Star_G07, 7, [hPos, hPos, m - 1, m - 1, y1Pos, y1Pos, y1Pos]);

    var sS04 = getStarArr(Star_S04, 4, y1Pos);

    var sB06 = [
        Star_B06[0][y1Pos],
        Star_B06[1][y1Pos],
        Star_B06[2][y2Pos % 4][hPos],
        Star_B06[3][y2Pos % 4][hPos],
        Star_B06[4][hPos],
        Star_B06[5][hPos]
    ];

    var OS05 = getStarArr(Star_OS5, 5, y2Pos);

    Place12 = new Array(12);

    for (var i = 0; i < 12; i++) {
        var StarA = [], StarB = [], StarC = [], Star6 = [];
        var lenStar = [0, 0, 0, 0];

        for (var k = 0; k < 6; k++) {
            if (sZ06[k] === i) {
                StarA[lenStar[0]] = StarM_A14[k] + getS04Str(StarM_A14[k], sS04);
                lenStar[0] += 1;
            }
            if (sB06[k] === i) {
                StarB[lenStar[1]] = StarM_B06[k];
                lenStar[1] += 1;
            }
        }

        for (var k = 0; k < 8; k++) {
            if (sT08[k] === i) {
                StarA[lenStar[0]] = StarM_A14[k + 6] + getS04Str(StarM_A14[k + 6], sS04);
                lenStar[0] += 1;
            }
        }

        for (var k = 0; k < 7; k++) {
            if (sG07[k] === i) {
                Star6[lenStar[3]] = StarM_A07[k] + getS04Str(StarM_A07[k], sS04);
                lenStar[3] += 1;
            }
        }

        for (var k = 0; k < 5; k++) {
            if (OS05[k] === i) {
                StarC[lenStar[2]] = StarO_S05[k];
                lenStar[2] += 1;
            }
        }

        Place12[i] = {
            MangA: HeavenlyStems[((y1Pos % 5) * 2 + (i < 2 ? i + 2 : i) % 10) % 10] + EarthlyBranches[i],
            MangB: Palace[(12 - lPos + i) % 12],
            MangC: (bPos == i ? Palace[12] : ""),
            StarA: StarA,
            StarB: StarB,
            StarC: StarC,
            Star6: Star6
        };
    }
}

function getStarArr(STAR, size, pos) {
    var starArray = [];
    for (var i = 0; i < size; i++) {
        starArray[i] = STAR[i][pos];
    }
    return starArray;
}

function getStarArrByPosArr(STAR, size, PosArr) {
    var starArray = [];
    for (var i = 0; i < size; i++) {
        starArray[i] = STAR[i][PosArr[i]];
    }
    return starArray;
}

function getS04Str(starName, sS04) {
    if (sS04[0] === starName) return '[祿]';
    if (sS04[1] === starName) return '[權]';
    if (sS04[2] === starName) return '[科]';
    if (sS04[3] === starName) return '[忌]';
    return '';
}

// =============================================================================
// 主要計算函數 - 封裝為標準接口
// =============================================================================

function calculateZiWeiChartComplete(birthData) {
    try {
        var y_Solar = birthData.year;
        var m_Solar = birthData.month;
        var d_Solar = birthData.day;
        var h_Solar = birthData.hour;
        var g_Solar = birthData.gender;

        computeZiWei(y_Solar, m_Solar, d_Solar, h_Solar, g_Solar);

        var lunarYear = GanGB[gan_global.y] + ZhiGB[zhi_global.y];
        var lunarMonth = lunar_global.m;
        var lunarDay = lunar_global.d;
        var isLeapMonth = lunar_global.l;

        var result = {
            basicInfo: {
                solarDate: `${birthData.year}年${birthData.month}月${birthData.day}日`,
                lunarDate: `${lunarYear}年${isLeapMonth ? '閏' : ''}${lunarMonth}月${lunarDay}日 ${birthData.hour}時`,
                gender: birthData.gender === 'male' ? '男' : '女',
                location: birthData.location || '',
                lifePalace: `${HeavenlyStems[(y1Pos + lPos) % 10]}${l}`,
                bodyPalace: `${HeavenlyStems[(y1Pos + bPos) % 10]}${b}`,
                elementalBureau: f
            },
            calculationSource: {
                engine: "cubshuang/ZiWeiDouShu",
                version: "v5",
                implementationVersion: "2.8.0",
                repository: "https://github.com/cubshuang/ZiWeiDouShu",
                demoPage: "https://cubshuang.github.io/ZiWeiDouShu/",
                license: "MIT License"
            },
            palaceConfiguration: Place12,
            fourTransformations: {
                L: getStarArr(Star_S04, 4, y1Pos)[0],
                Q: getStarArr(Star_S04, 4, y1Pos)[1],
                K: getStarArr(Star_S04, 4, y1Pos)[2],
                J: getStarArr(Star_S04, 4, y1Pos)[3]
            },
            calculationStatus: 'SUCCESS'
        };

        return result;

    } catch (error) {
        return {
            calculationStatus: 'ERROR',
            errorMessage: error.message,
            calculationSource: {
                engine: "cubshuang/ZiWeiDouShu",
                version: "v5"
            }
        };
    }
}

// 模組導出
module.exports = {
    calculateZiWeiChartComplete,
    computeZiWei,
    HeavenlyStems,
    EarthlyBranches,
    Palace,
    FiveElements,
    StarM_A14,
    StarM_A07,
    StarM_B06,
    StarO_S05
};
