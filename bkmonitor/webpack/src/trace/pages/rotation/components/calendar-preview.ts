/*
 * Tencent is pleased to support the open source community by making
 * 蓝鲸智云PaaS平台 (BlueKing PaaS) available.
 *
 * Copyright (C) 2021 THL A29 Limited, a Tencent company.  All rights reserved.
 *
 * 蓝鲸智云PaaS平台 (BlueKing PaaS) is licensed under the MIT License.
 *
 * License for 蓝鲸智云PaaS平台 (BlueKing PaaS):
 *
 * ---------------------------------------------------
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated
 * documentation files (the "Software"), to deal in the Software without restriction, including without limitation
 * the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and
 * to permit persons to whom the Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all copies or substantial portions of
 * the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO
 * THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF
 * CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS
 * IN THE SOFTWARE.
 */
import { randomColor } from '../utils';

export interface ICalendarDataUser {
  color: string;
  timeRange: string[];
  users: { id: string; name: string }[];
}
export interface ICalendarData {
  users: ICalendarDataUser[];
  data: {
    dates: {
      // 日历表一行的数据
      year: number;
      month: number;
      day: number;
      isOtherMonth: boolean;
      isCurDay: boolean;
    }[];
    data: {
      // 日历表一行的数据
      users: { id: string; name: string }[]; // 用户组
      color: string; // 颜色
      range: number[]; // 宽度 此宽度最大为一周的宽度 最小为0 最大为1 例如 [0.1, 0.5]
      isStartBorder?: boolean;
      other: {
        time: string;
        users: string;
      }; // 其他信息
    }[];
  }[];
}
export function getCalendar() {
  const today = new Date(); // 获取当前日期

  const year = today.getFullYear(); // 获取当前年份
  const month = today.getMonth(); // 获取当前月份

  const firstDay = new Date(year, month, 1); // 当月第一天的日期对象
  const lastDay = new Date(year, month + 1, 0); // 当月最后一天的日期对象

  const startDate = new Date(firstDay); // 日历表开始日期，初始为当月第一天
  startDate.setDate(startDate.getDate() - startDate.getDay()); // 向前推算到周日

  const endDate = new Date(lastDay); // 日历表结束日期，初始为当月最后一天
  endDate.setDate(endDate.getDate() + (6 - endDate.getDay())); // 向后推算到周六

  // 判断是否需要添加次月初的日期
  if (endDate.getMonth() === month) {
    endDate.setMonth(month + 1, 0); // 设置为下个月的最后一天
  }

  const calendar = []; // 存放日历表的二维数组
  let week = []; // 存放一周的日期

  const currentDate = new Date(startDate); // 当前遍历的日期，初始为开始日期

  // 遍历日期范围，生成日历表
  while (currentDate <= endDate) {
    // 获取日期的年、月、日
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth();
    const currentDay = currentDate.getDate();

    // 添加日期到一周数组
    week.push({
      year: currentYear,
      month: currentMonth,
      day: currentDay,
      isOtherMonth: currentMonth !== month,
      isCurDay: currentDay === today.getDate() && currentMonth === month
    });

    // 每周有7天，将一周的日期添加到日历表，并重置一周数组
    if (week.length === 7) {
      calendar.push(week);
      week = [];
    }

    // 增加一天
    currentDate.setDate(currentDate.getDate() + 1);
  }

  return calendar;
}

/* 将时间戳转为字符串格式 */
function timeStampToTimeStr(num: number) {
  const date = new Date(num);
  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
    hours: date.getHours(),
    minutes: date.getMinutes(),
    seconds: date.getSeconds(),
    hoursStr: date.getHours() < 10 ? `${0}${date.getHours()}` : date.getHours(),
    minutesStr: date.getMinutes() < 10 ? `${0}${date.getMinutes()}` : date.getMinutes()
  };
}
/* 根据时间戳段 获取百分比并输出字符串时间格式 */
export function getDateStrAndRange(timeRange: number[], totalRange: number[]) {
  const start = timeRange[0];
  const end = timeRange[1];
  const totalStart = totalRange[0];
  const totalEnd = totalRange[1];
  const range = [(start - totalStart) / (totalEnd - totalStart), (end - totalStart) / (totalEnd - totalStart)];
  const startObj = timeStampToTimeStr(start);
  const isStartBorder = startObj.hours === 0 && startObj.minutes === 0;
  const endObj = timeStampToTimeStr(end);
  const startTimeStr = `${startObj.year}-${startObj.month}-${startObj.day} ${startObj.hoursStr}:${startObj.minutesStr}`;
  const endTimeStr = `${endObj.year}-${endObj.month}-${endObj.day} ${endObj.hoursStr}:${endObj.minutesStr}`;
  const timeStr =
    startTimeStr.split(' ')[0] === endTimeStr.split(' ')[0]
      ? `${startTimeStr.split(' ')[0]} ${startTimeStr.split(' ')[1]}-${endTimeStr.split(' ')[1]}`
      : `${startTimeStr}-${endTimeStr}`;
  return {
    range,
    isStartBorder,
    timeStr
  };
}
/**
 * @description 将用户组可视化
 * @param data
 */
export function calendarDataConversion(data: ICalendarData) {
  const calendarData: ICalendarData = JSON.parse(JSON.stringify(data));
  const { users } = calendarData;
  calendarData.data = calendarData.data.map(row => {
    const { dates } = row;
    const rowTotalTimeRange = [
      `${dates[0].year}-${dates[0].month + 1}-${dates[0].day} 00:00`,
      `${dates[6].year}-${dates[6].month + 1}-${dates[6].day} 23:59`
    ];
    const temp = [];
    users.forEach(u => {
      const { timeRange } = u;
      const rowTotalTimeRangeNum = rowTotalTimeRange.map(item => new Date(item).getTime());
      const timeRangeNum = timeRange.map(item => new Date(item).getTime());
      if (timeRangeNum[0] < rowTotalTimeRangeNum[1] && timeRangeNum[1] > rowTotalTimeRangeNum[0]) {
        let tempRange = [];
        if (timeRangeNum[0] < rowTotalTimeRangeNum[0]) {
          tempRange = [rowTotalTimeRangeNum[0], timeRangeNum[1]];
        } else if (timeRangeNum[1] > rowTotalTimeRangeNum[1]) {
          tempRange = [timeRangeNum[0], rowTotalTimeRangeNum[1]];
        } else {
          tempRange = [timeRangeNum[0], timeRangeNum[1]];
        }
        const rangeStr = getDateStrAndRange(tempRange, rowTotalTimeRangeNum);
        temp.push({
          ...u,
          range: rangeStr.range,
          isStartBorder: rangeStr.isStartBorder,
          other: {
            time: rangeStr.timeStr,
            users: u.users.map(user => `${user.id}(${user.name})`).join(', ')
          }
        });
      }
    });
    return {
      ...row,
      data: temp
    };
  });
  return calendarData;
}

interface IDutyPlans {
  user_index?: number;
  users: {
    id: string;
    display_name: string;
    type: string;
  }[];
  work_times: {
    start_time: string;
    end_time: string;
  }[];
}

export interface IDutyPreviewParams {
  rule_id: number | string;
  duty_plans: IDutyPlans[];
}

/**
 * @description 将时间段相交的区域进行合并处理
 * @param times
 */
export function timeRangeMerger(timePeriods: { start_time: string; end_time: string }[]) {
  // 先对时间段按照开始时间进行排序
  timePeriods.sort((a, b) => {
    return new Date(a.start_time).getTime() - new Date(b.start_time).getTime();
  });

  const mergedPeriods = [];
  let currentPeriod = timePeriods[0];

  for (let i = 1; i < timePeriods.length; i++) {
    const nextPeriod = timePeriods[i];

    const currentEndTime = new Date(currentPeriod.end_time);
    const nextStartTime = new Date(nextPeriod.start_time);

    if (nextStartTime.getTime() <= currentEndTime.getTime()) {
      // 时间段相交，更新当前时间段的结束时间
      currentPeriod.end_time = nextPeriod.end_time;
    } else {
      // 时间段不相交，将当前时间段加入到合并后的数组中，并更新当前时间段为下一个时间段
      mergedPeriods.push(currentPeriod);
      currentPeriod = nextPeriod;
    }
  }

  // 将最后一个时间段加入到合并后的数组中
  mergedPeriods.push(currentPeriod);
  /* 判断跨行的数据 */
  // const result = [];
  // mergedPeriods.forEach(item => {

  // });
  return mergedPeriods;
}

/**
 * @description 根据后台接口数据转换为预览数据
 * @param params
 */
export function setPreviewDataOfServer(params: IDutyPlans[]) {
  const data = [];
  params.forEach((item, index) => {
    const users = item.users.map(u => ({ id: u.id, name: u.display_name || u.id }));
    timeRangeMerger(item.work_times).forEach(work => {
      data.push({
        users,
        color: randomColor(item.user_index === undefined ? index : item.user_index),
        timeRange: [work.start_time, work.end_time]
      });
    });
  });
  return data;
}